import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

type Session = { actorId: string; cookie: string };

const defaultPageExtraLogIds = Array.from(
  { length: 16 },
  (_, index) => `log-default-${index.toString().padStart(2, "0")}`,
);

async function createSession(label: string): Promise<Session> {
  const email = `${label}-${crypto.randomUUID()}@example.com`;
  const response = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: label,
      email,
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

async function seedDetailFixture() {
  const owner = await createSession("detail-owner");
  const other = await createSession("detail-other");
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "area-owner",
      owner.actorId,
      "Family Health",
      "family-health",
      "Appointments are current",
      "needs_attention",
      "HeartPulse",
      2,
      1_500_000_000_000,
    ),
    env.DB.prepare(
      "INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "area-other",
      other.actorId,
      "Other area",
      "other-area",
      null,
      "healthy",
      "Compass",
      1,
      1_500_000_000_001,
    ),
    env.DB.prepare(
      "INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "area-owner-null-standard",
      owner.actorId,
      "Unwritten Standard",
      "unwritten-standard",
      null,
      "healthy",
      "Compass",
      3,
      1_500_000_000_002,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, next_move, up_next_json, follow_up, last_activity_at, last_activity_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-owner",
      owner.actorId,
      "area-owner",
      "Book checkup",
      "book-checkup",
      "Choose a clinic",
      3,
      "open",
      "Call clinic",
      '["Book appointment","Collect results"]',
      1_800_000_000_000,
      1_700_000_000_000,
      "Captured next move",
      1_600_000_000_000,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-other",
      other.actorId,
      "area-other",
      "Other private Thread",
      "other-private-thread",
      null,
      1,
      "open",
      1_600_000_000_001,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, up_next_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-empty-up-next",
      owner.actorId,
      "area-owner",
      "Empty Up Next",
      "empty-up-next",
      null,
      4,
      "open",
      "[]",
      1_600_000_000_002,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, up_next_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-invalid-up-next",
      owner.actorId,
      "area-owner",
      "Invalid Up Next",
      "invalid-up-next",
      null,
      5,
      "open",
      '["Book appointment",1]',
      1_600_000_000_003,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-owner-nullable",
      owner.actorId,
      "area-owner",
      "Nullable Thread",
      "nullable-thread",
      null,
      6,
      "resolved",
      1_600_000_000_004,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-owner-foreign-area",
      owner.actorId,
      "area-other",
      "Cross-owner Area Thread",
      "foreign-area-thread",
      null,
      7,
      "open",
      1_600_000_000_005,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-owner-null-standard",
      owner.actorId,
      "area-owner-null-standard",
      "Thread under unwritten Standard",
      "null-standard-thread",
      null,
      8,
      "open",
      1_600_000_000_006,
    ),
  ]);

  return { owner, other };
}

async function seedActivityFixture(owner: Session, other: Session) {
  const defaultPageEntries = defaultPageExtraLogIds.map((id, index) =>
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      id,
      owner.actorId,
      "thread-owner",
      "next_action_change",
      `Captured default page entry ${index}`,
      null,
      `Move ${index}`,
      99 - index,
    ),
  );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "thread-owner-other",
      owner.actorId,
      "area-owner",
      "Owner's other Thread",
      "owner-other-thread",
      null,
      4,
      "open",
      1_600_000_000_002,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-new",
      owner.actorId,
      "thread-owner",
      "state_change",
      "Resolved the Thread",
      "open",
      "resolved",
      400,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-z",
      owner.actorId,
      "thread-owner",
      "next_action_change",
      "Changed the Next Move",
      "Call clinic",
      "Book appointment",
      300,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-a",
      owner.actorId,
      "thread-owner",
      "follow_up_change",
      "Set a Follow-up",
      null,
      "1800000000000",
      300,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-old",
      owner.actorId,
      "thread-owner",
      "area_move",
      "Moved to Family Health",
      "Other area",
      "Family Health",
      200,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-oldest",
      owner.actorId,
      "thread-owner",
      "next_action_change",
      "Captured a Next Move",
      null,
      "Call clinic",
      100,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-other-thread",
      owner.actorId,
      "thread-owner-other",
      "state_change",
      "Resolved the other Thread",
      "open",
      "resolved",
      500,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-other-owner",
      other.actorId,
      "thread-other",
      "state_change",
      "Resolved another owner's Thread",
      "open",
      "resolved",
      600,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "log-foreign-on-owner-thread",
      other.actorId,
      "thread-owner",
      "state_change",
      "Leaked log that must not be visible",
      "open",
      "resolved",
      700,
    ),
    ...defaultPageEntries,
  ]);
}

function cursorFor(value: object): string {
  return btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function nonCanonicalBase64UrlAlias(cursor: string): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const remainder = cursor.length % 4;
  const lastCharacter = cursor.at(-1);
  if ((remainder !== 2 && remainder !== 3) || lastCharacter === undefined) {
    throw new Error("Cursor must have trailing base64url padding bits");
  }

  const index = alphabet.indexOf(lastCharacter);
  return `${cursor.slice(0, -1)}${alphabet[index + 1]}`;
}

const validationError = {
  error: {
    code: "validation",
    message: "Invalid Activity Log pagination.",
    retryable: false,
  },
};

let fixture: Awaited<ReturnType<typeof seedDetailFixture>>;

beforeAll(async () => {
  fixture = await seedDetailFixture();
  await seedActivityFixture(fixture.owner, fixture.other);
});

describe("Thread detail", () => {
  it("returns every public Thread and Area field to the owner", async () => {
    const { owner } = fixture;

    const response = await SELF.fetch(
      "http://api.test/v1/threads/book-checkup",
      { headers: { cookie: owner.cookie } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      thread: {
        _id: "thread-owner",
        title: "Book checkup",
        slug: "book-checkup",
        summary: "Choose a clinic",
        areaId: "area-owner",
        order: 3,
        state: "open",
        nextMove: "Call clinic",
        upNext: ["Book appointment", "Collect results"],
        followUp: 1_800_000_000_000,
        lastActivityAt: 1_700_000_000_000,
        lastActivityContent: "Captured next move",
        createdAt: 1_600_000_000_000,
        revision: 0,
      },
      area: {
        _id: "area-owner",
        name: "Family Health",
        slug: "family-health",
        standard: "Appointments are current",
        condition: "needs_attention",
        icon: "HeartPulse",
        order: 2,
        createdAt: 1_500_000_000_000,
      },
    });
  });

  it("returns indistinguishable not-found results for missing and foreign slugs", async () => {
    const { owner } = fixture;
    const headers = { cookie: owner.cookie, origin: env.BROWSER_ORIGIN };
    const [missing, foreign, inconsistentArea] = await Promise.all([
      SELF.fetch("http://api.test/v1/threads/missing-thread", { headers }),
      SELF.fetch("http://api.test/v1/threads/other-private-thread", {
        headers,
      }),
      SELF.fetch("http://api.test/v1/threads/foreign-area-thread", {
        headers,
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
    const inconsistentAreaResult = {
      status: inconsistentArea.status,
      cors: inconsistentArea.headers.get("access-control-allow-origin"),
      credentials: inconsistentArea.headers.get(
        "access-control-allow-credentials",
      ),
      body: await inconsistentArea.json(),
    };

    expect(missingResult).toEqual({
      status: 404,
      cors: env.BROWSER_ORIGIN,
      credentials: "true",
      body: {
        error: {
          code: "not_found",
          message: "Thread not found.",
          retryable: false,
        },
      },
    });
    expect(foreignResult).toEqual(missingResult);
    expect(inconsistentAreaResult).toEqual(missingResult);
  });

  it("omits SQL NULL optional Thread fields from the public contract", async () => {
    const response = await SELF.fetch(
      "http://api.test/v1/threads/nullable-thread",
      { headers: { cookie: fixture.owner.cookie } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      thread: {
        _id: "thread-owner-nullable",
        title: "Nullable Thread",
        slug: "nullable-thread",
        areaId: "area-owner",
        order: 6,
        state: "resolved",
        createdAt: 1_600_000_000_004,
        revision: 0,
      },
      area: {
        _id: "area-owner",
        name: "Family Health",
        slug: "family-health",
        standard: "Appointments are current",
        condition: "needs_attention",
        icon: "HeartPulse",
        order: 2,
        createdAt: 1_500_000_000_000,
      },
    });
  });

  it("omits a SQL NULL Area Standard from the public contract", async () => {
    const response = await SELF.fetch(
      "http://api.test/v1/threads/null-standard-thread",
      { headers: { cookie: fixture.owner.cookie } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      thread: {
        _id: "thread-owner-null-standard",
        title: "Thread under unwritten Standard",
        slug: "null-standard-thread",
        areaId: "area-owner-null-standard",
        order: 8,
        state: "open",
        createdAt: 1_600_000_000_006,
        revision: 0,
      },
      area: {
        _id: "area-owner-null-standard",
        name: "Unwritten Standard",
        slug: "unwritten-standard",
        condition: "healthy",
        icon: "Compass",
        order: 3,
        createdAt: 1_500_000_000_002,
      },
    });
  });

  it.each(["empty-up-next", "invalid-up-next"])(
    "rejects a stored invalid Up Next value for %s without exposing it",
    async (slug) => {
      const response = await SELF.fetch(`http://api.test/v1/threads/${slug}`, {
        headers: { cookie: fixture.owner.cookie },
      });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "unexpected",
          message: "Unexpected error.",
          retryable: false,
        },
      });
    },
  );
});

describe("Activity Log", () => {
  it("defaults to a bounded page that contains only the owned Thread entries", async () => {
    const response = await SELF.fetch(
      "http://api.test/v1/threads/thread-owner/activity",
      { headers: { cookie: fixture.owner.cookie } },
    );

    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      entries: Array<Record<string, unknown>>;
      nextCursor?: string;
    };
    expect(page.entries).toHaveLength(20);
    expect(page.entries.slice(0, 5)).toEqual([
      {
        _id: "log-new",
        type: "state_change",
        content: "Resolved the Thread",
        previousValue: "open",
        newValue: "resolved",
        createdAt: 400,
      },
      {
        _id: "log-z",
        type: "next_action_change",
        content: "Changed the Next Move",
        previousValue: "Call clinic",
        newValue: "Book appointment",
        createdAt: 300,
      },
      {
        _id: "log-a",
        type: "follow_up_change",
        content: "Set a Follow-up",
        newValue: "1800000000000",
        createdAt: 300,
      },
      {
        _id: "log-old",
        type: "area_move",
        content: "Moved to Family Health",
        previousValue: "Other area",
        newValue: "Family Health",
        createdAt: 200,
      },
      {
        _id: "log-oldest",
        type: "next_action_change",
        content: "Captured a Next Move",
        newValue: "Call clinic",
        createdAt: 100,
      },
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("uses an opaque cursor to continue a stable page without duplicates or gaps", async () => {
    const first = await SELF.fetch(
      "http://api.test/v1/threads/thread-owner/activity?limit=2",
      { headers: { cookie: fixture.owner.cookie } },
    );
    expect(first.status).toBe(200);
    const firstPage = (await first.json()) as {
      entries: Array<{ _id: string }>;
      nextCursor: string;
    };
    expect(firstPage.entries.map((entry) => entry._id)).toEqual([
      "log-new",
      "log-z",
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const second = await SELF.fetch(
      `http://api.test/v1/threads/thread-owner/activity?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      { headers: { cookie: fixture.owner.cookie } },
    );
    expect(second.status).toBe(200);
    const secondPage = (await second.json()) as {
      entries: Array<{ _id: string }>;
      nextCursor?: string;
    };
    expect(secondPage.entries.map((entry) => entry._id)).toEqual([
      "log-a",
      "log-old",
    ]);

    let cursor = secondPage.nextCursor;
    const remainingPages: Array<{
      entries: Array<{ _id: string }>;
      nextCursor?: string;
    }> = [];
    while (cursor !== undefined) {
      const pageResponse = await SELF.fetch(
        `http://api.test/v1/threads/thread-owner/activity?limit=2&cursor=${encodeURIComponent(cursor)}`,
        { headers: { cookie: fixture.owner.cookie } },
      );
      expect(pageResponse.status).toBe(200);
      const page = (await pageResponse.json()) as {
        entries: Array<{ _id: string }>;
        nextCursor?: string;
      };
      remainingPages.push(page);
      cursor = page.nextCursor;
    }

    expect(remainingPages.at(-1)).toEqual({
      entries: [
        {
          _id: "log-default-15",
          type: "next_action_change",
          content: "Captured default page entry 15",
          newValue: "Move 15",
          createdAt: 84,
        },
      ],
    });
    expect(
      [
        ...firstPage.entries,
        ...secondPage.entries,
        ...remainingPages.flatMap((page) => page.entries),
      ].map((entry) => entry._id),
    ).toEqual([
      "log-new",
      "log-z",
      "log-a",
      "log-old",
      "log-oldest",
      ...defaultPageExtraLogIds,
    ]);
  });

  it("rejects a non-canonical base64url cursor alias", async () => {
    const cursor = cursorFor({ v: 1, createdAt: 1, id: "xx" });
    const response = await SELF.fetch(
      `http://api.test/v1/threads/thread-owner/activity?limit=2&cursor=${encodeURIComponent(nonCanonicalBase64UrlAlias(cursor))}`,
      { headers: { cookie: fixture.owner.cookie } },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(validationError);
  });

  it("excludes a foreign user's log even when it references the owner's Thread", async () => {
    const response = await SELF.fetch(
      "http://api.test/v1/threads/thread-owner/activity?limit=1",
      { headers: { cookie: fixture.owner.cookie } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entries: [
        {
          _id: "log-new",
          type: "state_change",
          content: "Resolved the Thread",
          previousValue: "open",
          newValue: "resolved",
          createdAt: 400,
        },
      ],
      nextCursor: expect.any(String),
    });
  });

  it("returns indistinguishable not-found results for a missing and foreign Thread", async () => {
    const headers = {
      cookie: fixture.owner.cookie,
      origin: env.BROWSER_ORIGIN,
    };
    const [missing, foreign] = await Promise.all([
      SELF.fetch("http://api.test/v1/threads/missing-thread/activity", {
        headers,
      }),
      SELF.fetch("http://api.test/v1/threads/thread-other/activity", {
        headers,
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
      body: {
        error: {
          code: "not_found",
          message: "Thread not found.",
          retryable: false,
        },
      },
    });
    expect(foreignResult).toEqual(missingResult);
  });

  it.each([
    ["0", "0", undefined],
    ["negative limit", "-1", undefined],
    ["fractional limit", "1.5", undefined],
    ["excessive limit", "51", undefined],
    ["non-numeric limit", "many", undefined],
    ["malformed base64 cursor", "2", "not-a-cursor"],
    ["invalid JSON cursor", "2", cursorFor({ not: "a cursor" })],
    [
      "unsafe timestamp cursor",
      "2",
      cursorFor({ v: 1, createdAt: Number.MAX_SAFE_INTEGER + 1, id: "log-a" }),
    ],
    [
      "unsupported cursor version",
      "2",
      cursorFor({ v: 2, createdAt: 300, id: "log-a" }),
    ],
  ])(
    "rejects %s with the stable validation error",
    async (_label, limit, cursor) => {
      const query = new URLSearchParams({ limit });
      if (cursor !== undefined) query.set("cursor", cursor);
      const response = await SELF.fetch(
        `http://api.test/v1/threads/thread-owner/activity?${query}`,
        { headers: { cookie: fixture.owner.cookie } },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(validationError);
    },
  );
});
