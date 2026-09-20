import type {
  ActivityLogPage,
  AreaSummary,
  Thread,
  ThreadDetail,
  ThreadNote,
} from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function createArea(session: Session, name = "Family Health") {
  return succeed<AreaSummary>("/v1/areas", {
    method: "POST",
    session,
    body: {
      name: `${name} ${crypto.randomUUID()}`,
      condition: "healthy",
      icon: "Compass",
    },
  });
}

async function createThread(
  session: Session,
  area: AreaSummary,
  overrides: { title?: string; summary?: string } = {},
) {
  return succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: {
      title: overrides.title ?? "Book checkup",
      ...(overrides.summary === undefined
        ? {}
        : { summary: overrides.summary }),
      areaId: area._id,
    },
  });
}

async function activityOf(session: Session, thread: Thread) {
  const page = await succeed<ActivityLogPage>(
    `/v1/threads/${thread._id}/activity?limit=50`,
    { session },
  );
  // Entries read newest first; a workflow reads better oldest first.
  return [...page.entries].reverse();
}

async function detailOf(session: Session, thread: Thread) {
  return succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, { session });
}

describe("Thread creation", () => {
  it("creates an Open Thread in the actor's Area with the next manual position", async () => {
    const owner = await createSession("thread-create");
    const area = await createArea(owner);

    const first = await createThread(owner, area, { title: "Book checkup" });
    const second = await createThread(owner, area, {
      title: "Refill prescription",
      summary: "Pharmacy closes early",
    });

    expect(first).toMatchObject({
      title: "Book checkup",
      areaId: area._id,
      state: "open",
      order: 0,
    });
    expect(first.slug).toMatch(/^book-checkup-[0-9a-f]{8}$/);
    expect(first).not.toHaveProperty("nextMove");
    expect(second).toMatchObject({
      order: 1,
      summary: "Pharmacy closes early",
    });
    expect(await activityOf(owner, first)).toEqual([]);
  });

  it("refuses a blank title", async () => {
    const owner = await createSession("thread-create-blank");
    const area = await createArea(owner);

    expectError(
      await call("/v1/threads", {
        method: "POST",
        session: owner,
        body: { title: "  ", areaId: area._id },
      }),
      {
        status: 400,
        code: "validation",
        message: "Thread title cannot be empty",
      },
    );
  });

  it("refuses to file a Thread under another owner's Area", async () => {
    const owner = await createSession("thread-create-foreign-owner");
    const other = await createSession("thread-create-foreign-other");
    const theirArea = await createArea(other);

    expectError(
      await call("/v1/threads", {
        method: "POST",
        session: owner,
        body: { title: "Book checkup", areaId: theirArea._id },
      }),
      { status: 404, code: "not_found", message: "Area not found." },
    );
    await expect(
      succeed<Thread[]>("/v1/threads", { session: other }),
    ).resolves.toEqual([]);
  });

  it("lists only the actor's Open Threads, in manual order", async () => {
    const owner = await createSession("thread-list-owner");
    const other = await createSession("thread-list-other");
    const area = await createArea(owner);
    const first = await createThread(owner, area, { title: "First" });
    const second = await createThread(owner, area, { title: "Second" });
    const resolved = await createThread(owner, area, { title: "Resolved" });
    await succeed(`/v1/threads/${resolved._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });
    await createThread(other, await createArea(other), { title: "Theirs" });

    const threads = await succeed<Thread[]>("/v1/threads", { session: owner });

    expect(threads.map((thread) => thread._id)).toEqual([
      first._id,
      second._id,
    ]);
  });
});

describe("Next Move changes", () => {
  it("records setting, changing, and clearing the Next Move", async () => {
    const owner = await createSession("thread-next-move");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);

    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Book appointment" },
    });
    const cleared = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: null },
    });

    expect(cleared).not.toHaveProperty("nextMove");
    expect(
      (await activityOf(owner, thread)).map((entry) => [
        entry.type,
        entry.content,
      ]),
    ).toEqual([
      ["next_action_change", 'Next move set to "Call clinic"'],
      [
        "next_action_change",
        'Next move changed from "Call clinic" to "Book appointment"',
      ],
      ["next_action_change", "Next move cleared"],
    ]);
  });

  it("stamps the Thread's denormalized last activity with the newest entry", async () => {
    const owner = await createSession("thread-last-activity");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);

    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });
    const detail = await detailOf(owner, thread);

    expect(detail.thread.lastActivityContent).toBe(
      'Next move set to "Call clinic"',
    );
    expect(detail.thread.lastActivityAt).toEqual(expect.any(Number));
  });

  it("writes nothing when the Next Move does not actually change", async () => {
    const owner = await createSession("thread-next-move-idempotent");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });

    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });

    expect(await activityOf(owner, thread)).toHaveLength(1);
  });
});

describe("Follow-up changes", () => {
  it("records a Follow-up in UTC, and clearing it", async () => {
    const owner = await createSession("thread-follow-up");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    const may20 = Date.UTC(2026, 4, 20);

    const scheduled = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { followUp: may20 },
    });
    const cleared = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { followUp: null },
    });

    expect(scheduled.followUp).toBe(may20);
    expect(cleared).not.toHaveProperty("followUp");
    expect(
      (await activityOf(owner, thread)).map((entry) => entry.content),
    ).toEqual(['Follow-up set to "May 20, 2026"', "Follow-up cleared"]);
  });
});

describe("Area reassignment", () => {
  it("moves a Thread and names both Areas in the Activity Log", async () => {
    const owner = await createSession("thread-area-move");
    const from = await createArea(owner, "Health");
    const to = await createArea(owner, "Home");
    const thread = await createThread(owner, from);

    const moved = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { areaId: to._id },
    });

    expect(moved.areaId).toBe(to._id);
    const entries = await activityOf(owner, thread);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "area_move",
      content: `Moved from "${from.name}" to "${to.name}"`,
      previousValue: from.name,
      newValue: to.name,
    });
    await expect(
      succeed<{ threads: Thread[] }>(`/v1/areas/${to.slug}`, {
        session: owner,
      }),
    ).resolves.toMatchObject({ threads: [{ _id: thread._id }] });
  });

  it("refuses a move into another owner's Area and changes nothing", async () => {
    const owner = await createSession("thread-area-move-foreign-owner");
    const other = await createSession("thread-area-move-foreign-other");
    const from = await createArea(owner);
    const theirs = await createArea(other);
    const thread = await createThread(owner, from);

    expectError(
      await call(`/v1/threads/${thread._id}`, {
        method: "PATCH",
        session: owner,
        body: { areaId: theirs._id },
      }),
      { status: 404, code: "not_found", message: "Area not found." },
    );
    expect((await detailOf(owner, thread)).thread.areaId).toBe(from._id);
    expect(await activityOf(owner, thread)).toEqual([]);
  });
});

describe("Up Next", () => {
  it("rewrites the line silently while the Next Move slot is full", async () => {
    const owner = await createSession("up-next-silent");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });

    const lined = await succeed<Thread>(`/v1/threads/${thread._id}/up-next`, {
      method: "PUT",
      session: owner,
      body: { moves: ["Book appointment", "Collect results"] },
    });

    expect(lined.upNext).toEqual(["Book appointment", "Collect results"]);
    expect(lined.nextMove).toBe("Call clinic");
    expect(await activityOf(owner, thread)).toHaveLength(1);
  });

  it("promotes the front move when the Next Move slot is empty, and logs it", async () => {
    const owner = await createSession("up-next-promote");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);

    const lined = await succeed<Thread>(`/v1/threads/${thread._id}/up-next`, {
      method: "PUT",
      session: owner,
      body: { moves: ["Book appointment", "Collect results"] },
    });

    expect(lined.nextMove).toBe("Book appointment");
    expect(lined.upNext).toEqual(["Collect results"]);
    expect(
      (await activityOf(owner, thread)).map((entry) => entry.content),
    ).toEqual(['Next move set to "Book appointment"']);
  });

  it("forgets an emptied line rather than storing an empty one", async () => {
    const owner = await createSession("up-next-empty");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });
    await succeed(`/v1/threads/${thread._id}/up-next`, {
      method: "PUT",
      session: owner,
      body: { moves: ["Book appointment"] },
    });

    const emptied = await succeed<Thread>(`/v1/threads/${thread._id}/up-next`, {
      method: "PUT",
      session: owner,
      body: { moves: [] },
    });

    expect(emptied).not.toHaveProperty("upNext");
    const stored = await env.DB.prepare(
      "SELECT up_next_json FROM threads WHERE id = ?",
    )
      .bind(thread._id)
      .first<{ up_next_json: string | null }>();
    expect(stored?.up_next_json).toBeNull();
  });

  it("refuses a blank move and refuses to line up moves on a resolved Thread", async () => {
    const owner = await createSession("up-next-refusals");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);

    expectError(
      await call(`/v1/threads/${thread._id}/up-next`, {
        method: "PUT",
        session: owner,
        body: { moves: ["Book appointment", "   "] },
      }),
      {
        status: 400,
        code: "validation",
        message: "Upcoming move cannot be empty",
      },
    );

    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });
    expectError(
      await call(`/v1/threads/${thread._id}/up-next`, {
        method: "PUT",
        session: owner,
        body: { moves: ["Book appointment"] },
      }),
      {
        status: 409,
        code: "conflict",
        message: "Cannot line up moves on a resolved thread",
      },
    );
  });
});

describe("Thread lifecycle", () => {
  it("resolving clears the attention state and names the discarded moves", async () => {
    const owner = await createSession("thread-resolve");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic", followUp: Date.UTC(2026, 4, 20) },
    });
    await succeed(`/v1/threads/${thread._id}/up-next`, {
      method: "PUT",
      session: owner,
      body: { moves: ["Book appointment", "Collect results"] },
    });

    const resolved = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved", resolutionNote: "Clinic confirmed" },
    });

    expect(resolved.state).toBe("resolved");
    expect(resolved).not.toHaveProperty("nextMove");
    expect(resolved).not.toHaveProperty("upNext");
    expect(resolved).not.toHaveProperty("followUp");
    expect(
      (await activityOf(owner, thread)).map((entry) => entry.content),
    ).toContain(
      'Resolved thread: Clinic confirmed — discarded upcoming moves: "Book appointment", "Collect results"',
    );
  });

  it("reopening restores nothing it cleared", async () => {
    const owner = await createSession("thread-reopen");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });

    const reopened = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "open" },
    });

    expect(reopened.state).toBe("open");
    expect(reopened).not.toHaveProperty("nextMove");
    expect(
      (await activityOf(owner, thread)).map((entry) => entry.content),
    ).toContain("Reopened thread");
  });
});

describe("Thread deletion", () => {
  it("takes the Activity Log and the Thread's Notes with it", async () => {
    const owner = await createSession("thread-delete");
    const area = await createArea(owner);
    const thread = await createThread(owner, area);
    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { nextMove: "Call clinic" },
    });
    await succeed<ThreadNote>(`/v1/threads/${thread._id}/notes`, {
      method: "POST",
      session: owner,
      body: { body: "Clinic opens at nine" },
    });

    await expect(
      succeed(`/v1/threads/${thread._id}`, {
        method: "DELETE",
        session: owner,
      }),
    ).resolves.toEqual({ acknowledged: true });

    expectError(await call(`/v1/threads/${thread.slug}`, { session: owner }), {
      status: 404,
      code: "not_found",
      message: "Thread not found.",
    });
    const logs = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM activity_log_entries WHERE thread_id = ?",
    )
      .bind(thread._id)
      .first<{ total: number }>();
    const notes = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM thread_notes WHERE thread_id = ?",
    )
      .bind(thread._id)
      .first<{ total: number }>();
    expect(logs?.total).toBe(0);
    expect(notes?.total).toBe(0);
  });

  it("answers not found when deleting another owner's Thread", async () => {
    const owner = await createSession("thread-delete-privacy-owner");
    const other = await createSession("thread-delete-privacy-other");
    const theirs = await createThread(other, await createArea(other));

    expectError(
      await call(`/v1/threads/${theirs._id}`, {
        method: "DELETE",
        session: owner,
      }),
      { status: 404, code: "not_found" },
    );
    await expect(
      succeed<Thread[]>("/v1/threads", { session: other }),
    ).resolves.toHaveLength(1);
  });
});

describe("Thread change privacy", () => {
  it("refuses every write against another owner's Thread", async () => {
    const owner = await createSession("thread-write-privacy-owner");
    const other = await createSession("thread-write-privacy-other");
    const theirs = await createThread(other, await createArea(other));

    for (const [path, method, body] of [
      [`/v1/threads/${theirs._id}`, "PATCH", { nextMove: "Mine now" }],
      [`/v1/threads/${theirs._id}/up-next`, "PUT", { moves: ["Mine"] }],
      [
        `/v1/threads/${theirs._id}/complete-next-move`,
        "POST",
        { expectedNextMove: null, expectedRevision: 0 },
      ],
      [`/v1/threads/${theirs._id}`, "DELETE", undefined],
    ] as const) {
      expectError(await call(path, { method, session: owner, body }), {
        status: 404,
        code: "not_found",
        message: "Thread not found.",
      });
    }

    expect(
      (await succeed<Thread[]>("/v1/threads", { session: other }))[0],
    ).toMatchObject({ _id: theirs._id, state: "open" });
  });
});
