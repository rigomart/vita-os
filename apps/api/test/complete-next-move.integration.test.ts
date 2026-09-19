import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { D1ThreadStore } from "../src/d1-thread-store";

type Session = { actorId: string; cookie: string };

type ThreadRow = {
  id: string;
  next_move: string | null;
  up_next_json: string | null;
  last_activity_at: number | null;
  last_activity_content: string | null;
  revision: number;
  last_completion_token: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  content: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: number;
};

async function createSession(label: string): Promise<Session> {
  const response = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: label,
      email: `${label}-${crypto.randomUUID()}@example.com`,
      password: "correct horse battery staple",
    }),
  });

  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return {
    actorId: body.user.id,
    cookie: response.headers.get("set-cookie") ?? "",
  };
}

async function seedThread(input: {
  owner: Session;
  nextMove: string | null;
  upNext?: string[];
  revision?: number;
  lastActivityAt?: number | null;
  lastActivityContent?: string | null;
  lastCompletionToken?: string | null;
}): Promise<{ threadId: string }> {
  const suffix = crypto.randomUUID();
  const areaId = `completion-area-${suffix}`;
  const threadId = `completion-thread-${suffix}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      areaId,
      input.owner.actorId,
      "Family Health",
      `family-health-${suffix}`,
      null,
      "healthy",
      "Compass",
      1,
      1_600_000_000_000,
    ),
    env.DB.prepare(
      `INSERT INTO threads (
        id, user_id, area_id, title, slug, summary, sort_order, state,
        next_move, up_next_json, follow_up, last_activity_at,
        last_activity_content, created_at, revision, last_completion_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      threadId,
      input.owner.actorId,
      areaId,
      "Book checkup",
      `book-checkup-${suffix}`,
      null,
      1,
      "open",
      input.nextMove,
      input.upNext === undefined ? null : JSON.stringify(input.upNext),
      null,
      input.lastActivityAt ?? null,
      input.lastActivityContent ?? null,
      1_600_000_000_001,
      input.revision ?? 0,
      input.lastCompletionToken ?? null,
    ),
  ]);

  return { threadId };
}

async function readThread(threadId: string): Promise<ThreadRow> {
  const row = await env.DB.prepare(
    `SELECT
        id, next_move, up_next_json, last_activity_at,
        last_activity_content, revision, last_completion_token
      FROM threads
      WHERE id = ?`,
  )
    .bind(threadId)
    .first<ThreadRow>();
  if (row === null) throw new Error("Seeded Thread is missing");
  return row;
}

async function readActivity(threadId: string): Promise<ActivityRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, type, content, previous_value, new_value, created_at
      FROM activity_log_entries
      WHERE thread_id = ?
      ORDER BY created_at, id`,
  )
    .bind(threadId)
    .all<ActivityRow>();
  return result.results;
}

function completeRequest(input: {
  cookie: string;
  threadId: string;
  expectedNextMove: string | null;
  origin?: string;
}) {
  return SELF.fetch(
    `http://api.test/v1/threads/${input.threadId}/complete-next-move`,
    {
      method: "POST",
      headers: {
        cookie: input.cookie,
        "content-type": "application/json",
        ...(input.origin === undefined ? {} : { origin: input.origin }),
      },
      body: JSON.stringify({ expectedNextMove: input.expectedNextMove }),
    },
  );
}

const notFoundError = {
  error: {
    code: "not_found",
    message: "Thread not found.",
    retryable: false,
  },
};

const conflictError = {
  error: {
    code: "conflict",
    message: "Next Move has changed.",
    retryable: false,
  },
};

const invalidCompletionError = {
  error: {
    code: "validation",
    message: "Invalid Next Move completion.",
    retryable: false,
  },
};

describe("completion outcome", () => {
  it("clears the final Next Move and records one completion", async () => {
    const owner = await createSession("completion-final-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Captured next move",
    });

    const response = await completeRequest({
      cookie: owner.cookie,
      threadId,
      expectedNextMove: "Call clinic",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "completed" });

    const thread = await readThread(threadId);
    const activity = await readActivity(threadId);
    expect(thread.next_move).toBeNull();
    expect(thread.up_next_json).toBeNull();
    expect(thread.revision).toBe(1);
    expect(thread.last_completion_token).toEqual(expect.any(String));
    expect(activity).toHaveLength(1);
    expect(activity[0]).toEqual({
      id: expect.any(String),
      type: "next_action_change",
      content: 'Completed "Call clinic" — next move cleared',
      previous_value: "Call clinic",
      new_value: null,
      created_at: thread.last_activity_at,
    });
    expect(thread.last_activity_content).toBe(activity[0].content);
  });

  it("promotes the first Up Next move and retains the remaining list", async () => {
    const owner = await createSession("completion-promotion-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      upNext: ["Book appointment", "Collect results"],
    });

    const response = await completeRequest({
      cookie: owner.cookie,
      threadId,
      expectedNextMove: "Call clinic",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "completed" });

    const thread = await readThread(threadId);
    const activity = await readActivity(threadId);
    expect(thread).toMatchObject({
      next_move: "Book appointment",
      up_next_json: '["Collect results"]',
      revision: 1,
    });
    expect(activity).toEqual([
      {
        id: expect.any(String),
        type: "next_action_change",
        content:
          'Completed "Call clinic" — next move set to "Book appointment"',
        previous_value: "Call clinic",
        new_value: "Book appointment",
        created_at: thread.last_activity_at,
      },
    ]);
    expect(thread.last_activity_content).toBe(activity[0].content);
  });

  it("stores SQL NULL after promoting the only Up Next move", async () => {
    const owner = await createSession("completion-last-up-next-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      upNext: ["Book appointment"],
    });

    const response = await completeRequest({
      cookie: owner.cookie,
      threadId,
      expectedNextMove: "Call clinic",
    });

    expect(response.status).toBe(200);
    expect((await readThread(threadId)).up_next_json).toBeNull();
  });

  it("does not write when stored and expected Next Moves are both absent", async () => {
    const owner = await createSession("completion-unchanged-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: null,
      revision: 7,
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Existing activity",
      lastCompletionToken: "previous-completion",
    });
    const before = await readThread(threadId);

    const response = await completeRequest({
      cookie: owner.cookie,
      threadId,
      expectedNextMove: null,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "unchanged" });
    expect(await readThread(threadId)).toEqual(before);
    expect(await readActivity(threadId)).toEqual([]);
  });

  it("returns indistinguishable not-found results for missing and foreign Threads", async () => {
    const owner = await createSession("completion-not-found-owner");
    const other = await createSession("completion-not-found-other");
    const { threadId } = await seedThread({
      owner: other,
      nextMove: "Call clinic",
    });
    const headers = { cookie: owner.cookie, origin: env.BROWSER_ORIGIN };
    const [missing, foreign] = await Promise.all([
      completeRequest({
        ...headers,
        threadId: "missing-completion-thread",
        expectedNextMove: "Call clinic",
      }),
      completeRequest({
        ...headers,
        threadId,
        expectedNextMove: "Call clinic",
      }),
    ]);

    const missingResult = {
      status: missing.status,
      cors: missing.headers.get("access-control-allow-origin"),
      credentials: missing.headers.get("access-control-allow-credentials"),
      body: await missing.json(),
    };
    const foreignResult = {
      status: foreign.status,
      cors: foreign.headers.get("access-control-allow-origin"),
      credentials: foreign.headers.get("access-control-allow-credentials"),
      body: await foreign.json(),
    };

    expect(missingResult).toEqual({
      status: 404,
      cors: env.BROWSER_ORIGIN,
      credentials: "true",
      body: notFoundError,
    });
    expect(foreignResult).toEqual(missingResult);
  });

  it("returns conflict without writing when the expected Next Move is stale", async () => {
    const owner = await createSession("completion-conflict-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      upNext: ["Book appointment"],
    });
    const before = await readThread(threadId);

    const response = await completeRequest({
      cookie: owner.cookie,
      threadId,
      expectedNextMove: "Old next move",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(conflictError);
    expect(await readThread(threadId)).toEqual(before);
    expect(await readActivity(threadId)).toEqual([]);
  });

  it.each([{}, { expectedNextMove: 1 }, { expectedNextMove: false }])(
    "requires an explicit string or null expected Next Move",
    async (body) => {
      const owner = await createSession("completion-validation-owner");
      const { threadId } = await seedThread({
        owner,
        nextMove: "Call clinic",
      });

      const response = await SELF.fetch(
        `http://api.test/v1/threads/${threadId}/complete-next-move`,
        {
          method: "POST",
          headers: {
            cookie: owner.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(invalidCompletionError);
      expect((await readThread(threadId)).next_move).toBe("Call clinic");
      expect(await readActivity(threadId)).toEqual([]);
    },
  );
});

describe("rollback", () => {
  it("rolls back the Thread and Activity Log when the generated ID already exists", async () => {
    const owner = await createSession("completion-rollback-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      upNext: ["Book appointment", "Collect results"],
      revision: 3,
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Captured next move",
      lastCompletionToken: "previous-completion",
    });
    const duplicateActivityLogId = `duplicate-activity-${crypto.randomUUID()}`;
    await env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        duplicateActivityLogId,
        owner.actorId,
        threadId,
        "next_action_change",
        "Existing entry",
        null,
        "Call clinic",
        1_600_000_000_002,
      )
      .run();
    const before = await readThread(threadId);
    const beforeActivity = await readActivity(threadId);
    const app = createApp(env, {
      createStore: () =>
        new D1ThreadStore(env.DB, {
          now: () => 1_800_000_000_000,
          newActivityLogId: () => duplicateActivityLogId,
          newOperationToken: () => "rollback-operation-token",
        }),
    });

    const response = await app.request(
      `http://api.test/v1/threads/${threadId}/complete-next-move`,
      {
        method: "POST",
        headers: {
          cookie: owner.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedNextMove: "Call clinic" }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unexpected",
        message: "Unexpected error.",
        retryable: false,
      },
    });
    expect(await readThread(threadId)).toEqual(before);
    expect(await readActivity(threadId)).toEqual(beforeActivity);
  });
});

describe("competing completion requests", () => {
  it("allows exactly one competing completion", async () => {
    const owner = await createSession("completion-competing-owner");
    const { threadId } = await seedThread({
      owner,
      nextMove: "Call clinic",
      upNext: ["Book appointment", "Collect results"],
    });

    const [first, second] = await Promise.all([
      completeRequest({
        cookie: owner.cookie,
        threadId,
        expectedNextMove: "Call clinic",
      }),
      completeRequest({
        cookie: owner.cookie,
        threadId,
        expectedNextMove: "Call clinic",
      }),
    ]);
    const responses = await Promise.all([first.json(), second.json()]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(responses).toContainEqual({ status: "completed" });
    expect(responses).toContainEqual(conflictError);
    expect(await readThread(threadId)).toMatchObject({
      next_move: "Book appointment",
      up_next_json: '["Collect results"]',
      revision: 1,
    });
    expect(await readActivity(threadId)).toHaveLength(1);
  });
});
