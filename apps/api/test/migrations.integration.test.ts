import type {
  ActivityLogPage,
  AreaSummary,
  Note,
  ThreadDetail,
  ThreadNote,
} from "@vita-os/contracts";

import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import worker from "../src/worker";

/**
 * Data migrations, checked the way a user would notice them: apply the schema
 * as it stood, write rows in that old shape, apply the migration under test,
 * and read everything back through the Worker.
 *
 * `MIGRATION_DB` is a database of its own, so migrations can be applied one
 * step at a time without disturbing the database every other test shares.
 */
const database = env.MIGRATION_DB;
const migrationEnv = { ...env, DB: database };

/** A migration's number, from its `0004_name.sql` file name. */
function numberOf(migration: { name: string }): number {
  return Number.parseInt(migration.name, 10);
}

function migrationsBefore(number: number) {
  return env.TEST_MIGRATIONS.filter(
    (migration) => numberOf(migration) < number,
  );
}

function migrationsThrough(number: number) {
  const migrations = env.TEST_MIGRATIONS.filter(
    (migration) => numberOf(migration) <= number,
  );
  expect(migrations.map(numberOf)).toContain(number);
  return migrations;
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", "http://browser.test");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return worker.fetch(
    new Request(`http://api.test${path}`, { ...init, headers }),
    migrationEnv,
  );
}

async function signUp(label: string) {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
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

async function read<T>(path: string, cookie: string): Promise<T> {
  const response = await request(path, { headers: { cookie } });
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

/**
 * Rows are written in the shape each migration expects to find, one step at a
 * time. Every read goes through the Worker, which speaks only the newest
 * schema, so every step is applied before any test reads.
 */
let owner: { actorId: string; cookie: string };
let mover: { actorId: string; cookie: string };
let folder: { actorId: string; cookie: string };

beforeAll(async () => {
  await applyD1Migrations(database, migrationsBefore(4));
  owner = await signUp("migration-owner");

  await database.batch([
    database
      .prepare(
        `INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "area-health",
        owner.actorId,
        "Health",
        "health-00000000",
        "Checkups are current",
        "critical",
        "HeartPulse",
        1,
        1_500_000_000_000,
      ),
    database
      .prepare(
        `INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "area-home",
        owner.actorId,
        "Home",
        "home-00000000",
        null,
        "healthy",
        "Home",
        0,
        1_500_000_000_001,
      ),
    database
      .prepare(
        `INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, next_move, up_next_json, follow_up, last_activity_at, last_activity_content, created_at, revision, last_change_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "thread-checkup",
        owner.actorId,
        "area-health",
        "Book checkup",
        "book-checkup-00000000",
        "Annual",
        3,
        "open",
        "Call clinic",
        JSON.stringify(["Book appointment"]),
        1_800_000_000_000,
        1_700_000_000_000,
        "Next move set",
        1_600_000_000_000,
        7,
        "token-7",
      ),
    database
      .prepare(
        `INSERT INTO threads (id, user_id, area_id, title, slug, sort_order, state, created_at, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "thread-gate",
        owner.actorId,
        "area-home",
        "Fix the gate",
        "fix-the-gate-00000000",
        4,
        "resolved",
        1_600_000_000_001,
        2,
      ),
    database
      .prepare(
        `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "log-1",
        owner.actorId,
        "thread-checkup",
        "next_move_change",
        'Next move set to "Call clinic"',
        null,
        "Call clinic",
        1_700_000_000_000,
      ),
    database
      .prepare(
        `INSERT INTO thread_notes (id, user_id, thread_id, body, state, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "note-1",
        owner.actorId,
        "thread-checkup",
        "Clinic opens at nine",
        "open",
        null,
        1_700_000_000_001,
        1_700_000_000_001,
      ),
  ]);

  await applyD1Migrations(database, migrationsThrough(4));

  mover = await signUp("tasks-migration-owner");
  await seedThreadsBeforeTasks(mover.actorId);
  await applyD1Migrations(database, migrationsThrough(5));

  folder = await signUp("follow-up-migration-owner");
  await seedThreadsBeforeFollowUpFold(folder.actorId);
  await applyD1Migrations(database, migrationsThrough(6));
});

describe("0004: Areas become optional labels", () => {
  it("keeps every Area's name, icon, and order, without Condition or Standard", async () => {
    const areas = await read<AreaSummary[]>("/v1/areas", owner.cookie);

    expect(areas).toEqual([
      {
        _id: "area-home",
        name: "Home",
        slug: "home-00000000",
        icon: "Home",
        order: 0,
        createdAt: 1_500_000_000_001,
      },
      {
        _id: "area-health",
        name: "Health",
        slug: "health-00000000",
        icon: "HeartPulse",
        order: 1,
        createdAt: 1_500_000_000_000,
      },
    ]);
  });

  it("keeps every Thread's Area and every other field", async () => {
    const checkup = await read<ThreadDetail>(
      "/v1/threads/book-checkup-00000000",
      owner.cookie,
    );
    const gate = await read<ThreadDetail>(
      "/v1/threads/fix-the-gate-00000000",
      owner.cookie,
    );

    expect(checkup.thread).toEqual({
      _id: "thread-checkup",
      title: "Book checkup",
      slug: "book-checkup-00000000",
      summary: "Annual",
      areaId: "area-health",
      order: 3,
      state: "open",
      tasks: [
        { _id: expect.any(String), text: "Call clinic" },
        { _id: expect.any(String), text: "Book appointment" },
        { _id: expect.any(String), text: "Follow up", date: 1_800_000_000_000 },
      ],
      focusedTaskId: checkup.thread.tasks?.[0]?._id,
      // Compatibility names (ADR 0033, removal in #402), same values.
      moves: [
        { _id: expect.any(String), text: "Call clinic" },
        { _id: expect.any(String), text: "Book appointment" },
        { _id: expect.any(String), text: "Follow up", date: 1_800_000_000_000 },
      ],
      focusedMoveId: checkup.thread.tasks?.[0]?._id,
      // Compatibility (ADR 0032, removal in #402): derived from the Tasks.
      followUp: 1_800_000_000_000,
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Next move set",
      createdAt: 1_600_000_000_000,
      revision: 7,
    });
    expect(checkup.area?._id).toBe("area-health");
    expect(gate.thread).toMatchObject({
      areaId: "area-home",
      state: "resolved",
      revision: 2,
    });
  });

  it("keeps each Thread's Activity Log and Thread Notes", async () => {
    const activity = await read<ActivityLogPage>(
      "/v1/threads/thread-checkup/activity",
      owner.cookie,
    );
    const notes = await read<ThreadNote[]>(
      "/v1/threads/thread-checkup/notes",
      owner.cookie,
    );

    expect(activity.entries.map((entry) => entry._id)).toEqual(["log-1"]);
    expect(notes.map((note) => note.body)).toEqual(["Clinic opens at nine"]);
  });

  it("lets a Thread lose its Area afterwards", async () => {
    const response = await request("/v1/threads/thread-gate", {
      method: "PATCH",
      headers: { cookie: owner.cookie },
      body: JSON.stringify({ areaId: null }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("areaId");
  });

  it("creates Areas with a name and an icon alone afterwards", async () => {
    const response = await request("/v1/areas", {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: JSON.stringify({ name: "Career", icon: "BriefcaseBusiness" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: "Career", order: 2 });
  });
});

/** Threads as they stood with a Next Move and an Up Next line. */
async function seedThreadsBeforeTasks(actorId: string) {
  const insert = (
    id: string,
    fields: {
      state?: "open" | "resolved";
      nextMove?: string;
      upNext?: string[];
      order: number;
    },
  ) =>
    database
      .prepare(
        `INSERT INTO threads (id, user_id, title, slug, sort_order, state, next_move, up_next_json, created_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actorId,
        id,
        `${id}-00000000`,
        fields.order,
        fields.state ?? "open",
        fields.nextMove ?? null,
        fields.upNext === undefined ? null : JSON.stringify(fields.upNext),
        1_600_000_000_000 + fields.order,
        4,
      );

  await database.batch([
    insert("queued", {
      nextMove: "Call clinic",
      upNext: ["Book slot", "Pay bill", "Collect results"],
      order: 0,
    }),
    insert("single", { nextMove: "Email the landlord", order: 1 }),
    insert("plain", { order: 2 }),
    insert("finished", { state: "resolved", order: 3 }),
    database
      .prepare(
        `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "log-next-move",
        actorId,
        "queued",
        "next_move_change",
        'Next move set to "Call clinic"',
        null,
        "Call clinic",
        1_700_000_000_000,
      ),
  ]);
}

describe("0005: Next Move and Up Next become peer Tasks", () => {
  async function threadOf(slug: string) {
    return (await read<ThreadDetail>(`/v1/threads/${slug}`, mover.cookie))
      .thread;
  }

  it("focuses the Next Move and follows it with Up Next, unfocused, in queue order", async () => {
    const thread = await threadOf("queued-00000000");

    expect(thread.tasks?.map((task) => task.text)).toEqual([
      "Call clinic",
      "Book slot",
      "Pay bill",
      "Collect results",
    ]);
    expect(thread.focusedTaskId).toBe(thread.tasks?.[0]?._id);
    expect(new Set(thread.tasks?.map((task) => task._id)).size).toBe(4);
    expect(thread.revision).toBe(4);
  });

  it("gives a Thread with only a Next Move one focused Task", async () => {
    const thread = await threadOf("single-00000000");

    expect(thread.tasks).toEqual([
      { _id: expect.any(String), text: "Email the landlord" },
    ]);
    expect(thread.focusedTaskId).toBe(thread.tasks?.[0]?._id);
  });

  it("brings a Thread with neither through with no Tasks and no focus", async () => {
    for (const slug of ["plain-00000000", "finished-00000000"]) {
      const thread = await threadOf(slug);
      expect(thread).not.toHaveProperty("tasks");
      expect(thread).not.toHaveProperty("focusedTaskId");
    }
  });

  it("leaves the Activity Log as it was written, and accepts Task completions", async () => {
    const thread = await threadOf("queued-00000000");
    const task = thread.tasks?.[1];
    if (!task) throw new Error("Migrated Thread lost its Tasks");

    const response = await request(
      `/v1/threads/queued/tasks/${task._id}/complete`,
      {
        method: "POST",
        headers: { cookie: mover.cookie },
        body: JSON.stringify({ expectedRevision: thread.revision }),
      },
    );
    expect(response.status).toBe(200);

    const activity = await read<ActivityLogPage>(
      "/v1/threads/queued/activity",
      mover.cookie,
    );
    expect(
      activity.entries.map((entry) => [entry.type, entry.content]),
    ).toEqual([
      ["move_completed", 'Completed "Book slot"'],
      ["next_move_change", 'Next move set to "Call clinic"'],
    ]);
  });
});

const FOLLOW_UP_DAY = new Date(2026, 9, 12).getTime();
const FOLLOW_UP_AFTERNOON = new Date(2026, 9, 12, 15, 30).getTime();

/** Threads as they stood with their own Follow-up date, on the Tasks schema. */
async function seedThreadsBeforeFollowUpFold(actorId: string) {
  const insert = (
    id: string,
    fields: {
      state?: "open" | "resolved";
      tasks?: { id: string; text: string }[];
      focused?: string;
      followUp?: number;
      order: number;
    },
  ) =>
    database
      .prepare(
        `INSERT INTO threads (id, user_id, title, slug, sort_order, state, moves_json, focused_move_id, follow_up, created_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actorId,
        id,
        `${id}-00000000`,
        fields.order,
        fields.state ?? "open",
        fields.tasks === undefined ? null : JSON.stringify(fields.tasks),
        fields.focused ?? null,
        fields.followUp ?? null,
        1_600_000_000_000 + fields.order,
        6,
      );

  await database.batch([
    insert("fold-timed", {
      tasks: [
        { id: "call", text: "Call clinic" },
        { id: "book", text: "Book slot" },
      ],
      focused: "call",
      followUp: FOLLOW_UP_AFTERNOON,
      order: 0,
    }),
    insert("fold-bare-dated", { followUp: FOLLOW_UP_DAY, order: 1 }),
    insert("fold-undated", {
      tasks: [{ id: "email", text: "Email the landlord" }],
      focused: "email",
      order: 2,
    }),
    insert("fold-finished", {
      state: "resolved",
      followUp: FOLLOW_UP_DAY,
      order: 3,
    }),
    database
      .prepare(
        `INSERT INTO notes (id, user_id, body, attention_date, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "note-dated",
        actorId,
        "Water the plants",
        FOLLOW_UP_AFTERNOON,
        "open",
        1_700_000_000_000,
      ),
    database
      .prepare(
        `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "log-follow-up",
        actorId,
        "fold-timed",
        "follow_up_change",
        "Follow-up set",
        null,
        String(FOLLOW_UP_AFTERNOON),
        1_700_000_000_000,
      ),
  ]);
}

describe("0006: a Thread's Follow-up date folds into its Tasks", () => {
  async function threadOf(slug: string) {
    return (await read<ThreadDetail>(`/v1/threads/${slug}`, folder.cookie))
      .thread;
  }

  it("appends a dated Follow up Task at the same instant, time kept, after the existing Tasks", async () => {
    const thread = await threadOf("fold-timed-00000000");

    expect(thread.tasks).toEqual([
      { _id: "call", text: "Call clinic" },
      { _id: "book", text: "Book slot" },
      {
        _id: expect.any(String),
        text: "Follow up",
        date: FOLLOW_UP_AFTERNOON,
      },
    ]);
    // Not focused: the Focused Task is the one it was.
    expect(thread.focusedTaskId).toBe("call");
    expect(thread.tasks?.[2]?._id).toMatch(/^[0-9a-f]{32}$/);
    expect(thread.revision).toBe(6);
  });

  it("starts the Tasks of a Thread that had none, with a date-only Task", async () => {
    const thread = await threadOf("fold-bare-dated-00000000");

    expect(thread.tasks).toEqual([
      { _id: expect.any(String), text: "Follow up", date: FOLLOW_UP_DAY },
    ]);
    expect(thread).not.toHaveProperty("focusedTaskId");
  });

  it("leaves a Thread without a Follow-up date as it was", async () => {
    const thread = await threadOf("fold-undated-00000000");

    expect(thread.tasks).toEqual([
      { _id: "email", text: "Email the landlord" },
    ]);
    expect(thread.focusedTaskId).toBe("email");
    expect(thread).not.toHaveProperty("followUp");
  });

  it("leaves a Resolved Thread as it was", async () => {
    const thread = await threadOf("fold-finished-00000000");

    expect(thread).not.toHaveProperty("tasks");
    expect(thread).not.toHaveProperty("followUp");
    expect(thread.state).toBe("resolved");
  });

  it("keeps the follow_up column, no longer read, and every Activity Log entry", async () => {
    const stored = await database
      .prepare(
        "SELECT id, follow_up FROM threads WHERE user_id = ? ORDER BY id",
      )
      .bind(folder.actorId)
      .all<{ id: string; follow_up: number | null }>();
    expect(stored.results).toEqual([
      { id: "fold-bare-dated", follow_up: FOLLOW_UP_DAY },
      { id: "fold-finished", follow_up: FOLLOW_UP_DAY },
      { id: "fold-timed", follow_up: FOLLOW_UP_AFTERNOON },
      { id: "fold-undated", follow_up: null },
    ]);

    const activity = await read<ActivityLogPage>(
      "/v1/threads/fold-timed/activity",
      folder.cookie,
    );
    expect(
      activity.entries.map((entry) => [entry.type, entry.content]),
    ).toEqual([["follow_up_change", "Follow-up set"]]);
  });

  it("keeps every Standalone Note's Follow-up date", async () => {
    const notes = await read<Note[]>("/v1/notes", folder.cookie);

    expect(notes).toEqual([
      expect.objectContaining({
        body: "Water the plants",
        followUp: FOLLOW_UP_AFTERNOON,
      }),
    ]);
  });
});
