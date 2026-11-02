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
let retainedFollowUps: { id: string; follow_up: number | null }[];
const cleanupTables = [
  "areas",
  "threads",
  "notes",
  "thread_notes",
  "activity_log_entries",
] as const;
let beforeCleanup: Record<string, Record<string, unknown>[]>;
let columnsBeforeCleanup: Record<string, unknown>[];
let schemaBeforeCleanup: Record<string, unknown>[];
let afterCleanup: Record<string, Record<string, unknown>[]>;
let columnsAfterCleanup: Record<string, unknown>[];
let schemaAfterCleanup: Record<string, unknown>[];
let repeater: { actorId: string; cookie: string };
let notesBeforeRepeat: Record<string, unknown>[];
let noteColumnsBeforeRepeat: Record<string, unknown>[];
let schemaBeforeRepeat: Record<string, unknown>[];
let schemaAfterRepeat: Record<string, unknown>[];
let recorder: { actorId: string; cookie: string };
let threadNotesBeforeCleanup: Record<string, unknown>[];
let threadNoteColumnsBeforeCleanup: Record<string, unknown>[];
let schemaBeforeThreadNoteCleanup: Record<string, unknown>[];
let schemaAfterThreadNoteCleanup: Record<string, unknown>[];
let threadNotesAfterCleanup: Record<string, unknown>[];
let storyteller: { actorId: string; cookie: string };
let neighbor: { actorId: string; cookie: string };
let entriesBeforeStory: Record<string, unknown>[];
let entryColumnsBeforeStory: Record<string, unknown>[];
let schemaBeforeStory: Record<string, unknown>[];
let entriesAt0010: Record<string, unknown>[];
let entryColumnsAt0010: Record<string, unknown>[];
let schemaAt0010: Record<string, unknown>[];

async function readSchema() {
  return (
    await database
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all<Record<string, unknown>>()
  ).results;
}

async function readColumns(table: string) {
  return (
    await database
      .prepare(`PRAGMA table_info(${table})`)
      .all<Record<string, unknown>>()
  ).results;
}

/**
 * The stored Focused Task. The API no longer reads it (ADR 0044), so what the
 * earlier migrations wrote is checked in the column itself.
 */
async function storedFocus(threadId: string) {
  return database
    .prepare("SELECT focused_move_id FROM threads WHERE id = ?")
    .bind(threadId)
    .first<string | null>("focused_move_id");
}

async function readThreadNotes() {
  return (
    await database
      .prepare("SELECT * FROM thread_notes ORDER BY id")
      .all<Record<string, unknown>>()
  ).results;
}

async function readNotes() {
  return (
    await database
      .prepare("SELECT * FROM notes ORDER BY id")
      .all<Record<string, unknown>>()
  ).results;
}

async function cleanupSnapshot() {
  return Object.fromEntries(
    await Promise.all(
      cleanupTables.map(async (table) => {
        const rows = await database
          .prepare(`SELECT * FROM ${table} ORDER BY id`)
          .all<Record<string, unknown>>();
        return [
          table,
          rows.results.map(({ follow_up: _retired, ...row }) => row),
        ];
      }),
    ),
  );
}

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

  // Production-shaped rows after 0006, including a Repeat from #415.
  await database.batch([
    database
      .prepare(`INSERT INTO threads (id, user_id, title, slug, sort_order, state, moves_json, focused_move_id, created_at, revision, last_change_token)
      VALUES ('cleanup-repeat', ?, 'Check in', 'cleanup-repeat', 4, 'open', ?, 'repeat', 1700000000000, 9, 'saved-token')`)
      .bind(
        folder.actorId,
        JSON.stringify([
          {
            id: "repeat",
            text: "Check in",
            date: FOLLOW_UP_DAY,
            repeat: { kind: "days", every: 2 },
          },
        ]),
      ),
    database
      .prepare(`INSERT INTO threads (id, user_id, title, slug, sort_order, state, created_at)
      VALUES ('cleanup-plain', ?, 'Unscheduled', 'cleanup-plain', 5, 'open', 1700000000001)`)
      .bind(folder.actorId),
    database
      .prepare(`INSERT INTO notes (id, user_id, body, state, completed_at, created_at, updated_at)
      VALUES ('cleanup-note', ?, 'Archived undated Note', 'done', 1700000000002, 1700000000001, 1700000000002)`)
      .bind(folder.actorId),
  ]);
  retainedFollowUps = (
    await database
      .prepare(
        "SELECT id, follow_up FROM threads WHERE user_id = ? AND id LIKE 'fold-%' ORDER BY id",
      )
      .bind(folder.actorId)
      .all<{ id: string; follow_up: number | null }>()
  ).results;
  beforeCleanup = await cleanupSnapshot();
  columnsBeforeCleanup = (
    await database
      .prepare("PRAGMA table_info(threads)")
      .all<Record<string, unknown>>()
  ).results;
  schemaBeforeCleanup = (
    await database
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all<Record<string, unknown>>()
  ).results;
  await applyD1Migrations(database, migrationsThrough(7));
  afterCleanup = await cleanupSnapshot();
  columnsAfterCleanup = await readColumns("threads");
  schemaAfterCleanup = await readSchema();

  // Notes as an API without Repeats on Notes saves them, before 0008.
  repeater = await signUp("repeat-migration-owner");
  await database.batch(
    [
      ["repeat-open-dated", "Pay the utility bill", NOTE_DATE, "open", null],
      ["repeat-open-undated", "Gift ideas", null, "open", null],
      ["repeat-done-dated", "Renew insurance", NOTE_DATE, "done", NOTE_DATE],
    ].map(([id, body, date, state, completedAt]) =>
      database
        .prepare(
          `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1700000000000, 1700000000000)`,
        )
        .bind(id, repeater.actorId, body, date, state, completedAt),
    ),
  );
  notesBeforeRepeat = await readNotes();
  noteColumnsBeforeRepeat = await readColumns("notes");
  schemaBeforeRepeat = await readSchema();
  await applyD1Migrations(database, migrationsThrough(8));
  schemaAfterRepeat = await readSchema();

  recorder = await signUp("thread-note-migration-owner");
  await database.batch([
    database
      .prepare(
        `INSERT INTO threads (id, user_id, title, slug, sort_order, state, created_at)
         VALUES ('record-thread', ?, 'Dentist', 'record-thread', 0, 'open', 1700000000000)`,
      )
      .bind(recorder.actorId),
    ...[
      ["record-open", "Clinic opens at nine", "open", null, 1_700_000_000_100],
      [
        "record-done",
        "Old consultation",
        "done",
        1_700_000_000_300,
        1_700_000_000_200,
      ],
    ].map(([id, body, state, completedAt, createdAt]) =>
      database
        .prepare(
          `INSERT INTO thread_notes (id, user_id, thread_id, body, state, completed_at, created_at, updated_at)
           VALUES (?, ?, 'record-thread', ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          recorder.actorId,
          body,
          state,
          completedAt,
          createdAt,
          createdAt,
        ),
    ),
  ]);
  threadNotesBeforeCleanup = await readThreadNotes();
  threadNoteColumnsBeforeCleanup = await readColumns("thread_notes");
  schemaBeforeThreadNoteCleanup = await readSchema();
  await applyD1Migrations(database, migrationsThrough(9));
  schemaAfterThreadNoteCleanup = await readSchema();
  threadNotesAfterCleanup = await readThreadNotes();

  storyteller = await signUp("story-migration-owner");
  neighbor = await signUp("story-migration-neighbor");
  await seedStoryBeforeNoteLines(storyteller.actorId, neighbor.actorId);
  entriesBeforeStory = await readEntries();
  entryColumnsBeforeStory = await readColumns("activity_log_entries");
  schemaBeforeStory = await readSchema();
  await applyD1Migrations(database, migrationsThrough(10));
  entriesAt0010 = await readEntries();
  entryColumnsAt0010 = await readColumns("activity_log_entries");
  schemaAt0010 = await readSchema();
  await applyD1Migrations(database, migrationsThrough(11));
});

async function readEntries() {
  return (
    await database
      .prepare("SELECT * FROM activity_log_entries ORDER BY id")
      .all<Record<string, unknown>>()
  ).results;
}

const STORY = 1_750_000_000_000;

/**
 * A Thread's story as the API before 0010 stored it: Thread Notes and an
 * Activity Log that knows nothing about them. One Note was written with a
 * completion, so it shares that entry's timestamp. A neighbor's Note at that
 * same instant, in a Thread of their own, belongs to no one else's line.
 */
async function seedStoryBeforeNoteLines(actorId: string, neighborId: string) {
  const thread = (id: string, owner: string) =>
    database
      .prepare(
        `INSERT INTO threads (id, user_id, title, slug, sort_order, state, created_at)
         VALUES (?, ?, ?, ?, 0, 'open', ?)`,
      )
      .bind(id, owner, id, id, STORY)
      .run();
  await thread("story-thread", actorId);
  await thread("story-quiet", actorId);
  await thread("story-neighbor", neighborId);
  const note = (
    id: string,
    owner: string,
    threadId: string,
    body: string,
    at: number,
  ) =>
    database
      .prepare(
        `INSERT INTO thread_notes (id, user_id, thread_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, owner, threadId, body, at, at + 5);
  const entry = (
    id: string,
    owner: string,
    threadId: string,
    type: string,
    content: string,
    previous: string | null,
    next: string | null,
    at: number,
  ) =>
    database
      .prepare(
        `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, owner, threadId, type, content, previous, next, at);
  await database.batch([
    note(
      "story-letter",
      actorId,
      "story-thread",
      "A letter came",
      STORY + 1_000,
    ),
    entry(
      "story-call-done",
      actorId,
      "story-thread",
      "move_completed",
      'Completed "Call the office"',
      "Call the office",
      null,
      STORY + 2_000,
    ),
    note(
      "story-call-note",
      actorId,
      "story-thread",
      "They need the form signed",
      STORY + 2_000,
    ),
    entry(
      "story-form-done",
      actorId,
      "story-thread",
      "move_completed",
      'Completed "Send the form"',
      "Send the form",
      null,
      STORY + 3_000,
    ),
    entry(
      "story-labeled",
      actorId,
      "story-thread",
      "area_move",
      'Added to "Home"',
      null,
      "Home",
      STORY + 4_000,
    ),
    note(
      "story-later",
      actorId,
      "story-thread",
      "Clerk confirmed",
      STORY + 5_000,
    ),
    note(
      "story-elsewhere",
      neighborId,
      "story-neighbor",
      "Unrelated",
      STORY + 3_000,
    ),
  ]);
}

describe("0011: Tasks added and removed join the Activity Log", () => {
  it("keeps every entry as stored, every column included", async () => {
    const after = new Map(
      (await readEntries()).map((row) => [row.id as string, row]),
    );
    expect(entriesAt0010.some((row) => row.thread_note_id !== null)).toBe(true);
    for (const row of entriesAt0010) {
      expect(after.get(row.id as string)).toEqual(row);
    }
  });

  it("adds only the two types, changing nothing else", async () => {
    expect(await readColumns("activity_log_entries")).toEqual(
      entryColumnsAt0010,
    );
    const schema = await readSchema();
    const table = schema.find((row) => row.name === "activity_log_entries");
    expect(String(table?.sql)).toContain(
      "CHECK (type IN ('area_move', 'next_move_change', 'move_completed', 'note_added', 'task_added', 'task_removed', 'state_change', 'follow_up_change'))",
    );
    const indexes = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.type === "index");
    expect(indexes(schema)).toEqual(indexes(schemaAt0010));
    const unrelated = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.tbl_name !== "activity_log_entries");
    expect(unrelated(schema)).toEqual(unrelated(schemaAt0010));
    expect(
      (await database.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });

  it("takes the API before it and the API after it, and reads Task lines through the Worker", async () => {
    await database
      .prepare(
        `INSERT INTO threads (id, user_id, title, slug, sort_order, state, created_at)
         VALUES ('story-plan', ?, 'story-plan', 'story-plan', 0, 'open', ?)`,
      )
      .bind(storyteller.actorId, STORY)
      .run();
    const insert = (
      id: string,
      type: string,
      content: string,
      previous: string | null,
      next: string | null,
      at: number,
      threadNoteId: string | null = null,
    ) =>
      database
        .prepare(
          `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at, thread_note_id)
           VALUES (?, ?, 'story-plan', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          storyteller.actorId,
          type,
          content,
          previous,
          next,
          at,
          threadNoteId,
        );
    await database.batch([
      insert(
        "before-0011-completion",
        "move_completed",
        'Completed "Call the office"',
        "Call the office",
        null,
        STORY + 1_000,
        "plan-note-id",
      ),
      insert(
        "after-0011-added",
        "task_added",
        'Added "Book a slot"',
        null,
        "Book a slot",
        STORY + 2_000,
      ),
      insert(
        "after-0011-removed",
        "task_removed",
        'Removed "Book a slot"',
        "Book a slot",
        null,
        STORY + 3_000,
      ),
    ]);

    const activity = await read<ActivityLogPage>(
      "/v1/threads/story-plan/activity",
      storyteller.cookie,
    );
    expect(activity.entries).toEqual([
      {
        _id: "after-0011-removed",
        type: "task_removed",
        content: 'Removed "Book a slot"',
        previousValue: "Book a slot",
        createdAt: STORY + 3_000,
      },
      {
        _id: "after-0011-added",
        type: "task_added",
        content: 'Added "Book a slot"',
        newValue: "Book a slot",
        createdAt: STORY + 2_000,
      },
      {
        _id: "before-0011-completion",
        type: "move_completed",
        content: 'Completed "Call the office"',
        previousValue: "Call the office",
        threadNoteId: "plan-note-id",
        createdAt: STORY + 1_000,
      },
    ]);
    await expect(
      insert("plan-unknown", "started", "Started", null, null, STORY).run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe("0010: Thread Notes join the Activity Log", () => {
  it("keeps every entry as stored, naming the Note a completion was written with", async () => {
    const after = new Map(
      (await readEntries()).map((row) => [row.id as string, row]),
    );
    expect(entriesBeforeStory.length).toBeGreaterThan(3);
    for (const row of entriesBeforeStory) {
      expect(after.get(row.id as string)).toEqual({
        ...row,
        thread_note_id: row.id === "story-call-done" ? "story-call-note" : null,
      });
    }
  });

  it("adds one Note line per other Thread Note, at its creation time, for every owner", async () => {
    const lines = (
      await database
        .prepare(
          `SELECT user_id, thread_id, type, content, previous_value, new_value, created_at, thread_note_id
           FROM activity_log_entries WHERE type = 'note_added' ORDER BY thread_note_id`,
        )
        .all<Record<string, unknown>>()
    ).results;
    const notes = (
      await database
        .prepare(
          "SELECT id, user_id, thread_id, created_at FROM thread_notes WHERE id != 'story-call-note' ORDER BY id",
        )
        .all<{
          id: string;
          user_id: string;
          thread_id: string;
          created_at: number;
        }>()
    ).results;
    expect(notes.length).toBeGreaterThan(4);
    expect(lines).toEqual(
      notes.map((note) => ({
        user_id: note.user_id,
        thread_id: note.thread_id,
        type: "note_added",
        content: "Note added",
        previous_value: null,
        new_value: null,
        created_at: note.created_at,
        thread_note_id: note.id,
      })),
    );
  });

  it("reads the story through the API, newest first", async () => {
    const activity = await read<ActivityLogPage>(
      "/v1/threads/story-thread/activity",
      storyteller.cookie,
    );
    expect(
      activity.entries.map(({ _id, ...entry }) => ({
        ...entry,
        ...(_id.startsWith("story-") ? { _id } : {}),
      })),
    ).toEqual([
      {
        type: "note_added",
        content: "Note added",
        threadNoteId: "story-later",
        createdAt: STORY + 5_000,
      },
      {
        _id: "story-labeled",
        type: "area_move",
        content: 'Added to "Home"',
        newValue: "Home",
        createdAt: STORY + 4_000,
      },
      {
        _id: "story-form-done",
        type: "move_completed",
        content: 'Completed "Send the form"',
        previousValue: "Send the form",
        createdAt: STORY + 3_000,
      },
      {
        _id: "story-call-done",
        type: "move_completed",
        content: 'Completed "Call the office"',
        previousValue: "Call the office",
        threadNoteId: "story-call-note",
        createdAt: STORY + 2_000,
      },
      {
        type: "note_added",
        content: "Note added",
        threadNoteId: "story-letter",
        createdAt: STORY + 1_000,
      },
    ]);
    await expect(
      read<ActivityLogPage>(
        "/v1/threads/story-quiet/activity",
        storyteller.cookie,
      ),
    ).resolves.toEqual({ entries: [] });
  });

  it("adds only the nullable thread_note_id and the new type, changing nothing else", async () => {
    expect(await readColumns("activity_log_entries")).toEqual([
      ...entryColumnsBeforeStory,
      {
        cid: entryColumnsBeforeStory.length,
        name: "thread_note_id",
        type: "TEXT",
        notnull: 0,
        dflt_value: null,
        pk: 0,
      },
    ]);
    const schema = schemaAt0010;
    const table = schema.find((row) => row.name === "activity_log_entries");
    expect(String(table?.sql)).toContain(
      "CHECK (type IN ('area_move', 'next_move_change', 'move_completed', 'note_added', 'state_change', 'follow_up_change'))",
    );
    expect(
      schema
        .filter((row) => row.tbl_name === "activity_log_entries")
        .map((row) => row.name),
    ).toEqual([
      "activity_log_entries",
      "activity_log_entries_by_owner_thread_time",
    ]);
    const unrelated = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.tbl_name !== "activity_log_entries");
    expect(unrelated(schema)).toEqual(unrelated(schemaBeforeStory));
    expect(
      (await database.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });

  it("takes an entry from the API before it, with no Note", async () => {
    await database
      .prepare(
        `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
         VALUES ('story-old-api', ?, 'story-quiet', 'move_completed', 'Completed "Water"', 'Water', NULL, ?)`,
      )
      .bind(storyteller.actorId, STORY + 9_000)
      .run();
    const activity = await read<ActivityLogPage>(
      "/v1/threads/story-quiet/activity",
      storyteller.cookie,
    );
    expect(activity.entries).toEqual([
      {
        _id: "story-old-api",
        type: "move_completed",
        content: 'Completed "Water"',
        previousValue: "Water",
        createdAt: STORY + 9_000,
      },
    ]);
  });
});

describe("0009: Thread Notes stop needing a state", () => {
  it("keeps every Thread Note as stored, state and completion included", async () => {
    expect(threadNotesBeforeCleanup.length).toBeGreaterThan(2);
    expect(threadNotesAfterCleanup).toEqual(threadNotesBeforeCleanup);
  });

  it("defaults state to open, drops its check and indexes, and changes nothing else", async () => {
    expect(await readColumns("thread_notes")).toEqual(
      threadNoteColumnsBeforeCleanup.map((column) =>
        column.name === "state" ? { ...column, dflt_value: "'open'" } : column,
      ),
    );
    const threadNotesSchema = schemaAfterThreadNoteCleanup.filter(
      (row) => row.tbl_name === "thread_notes",
    );
    expect(threadNotesSchema.map((row) => row.name)).toEqual([
      "thread_notes",
      "thread_notes_by_owner_thread_created",
    ]);
    expect(
      threadNotesSchema.every((row) => !/\bCHECK\b/i.test(String(row.sql))),
    ).toBe(true);
    const unrelated = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.tbl_name !== "thread_notes");
    expect(unrelated(schemaAfterThreadNoteCleanup)).toEqual(
      unrelated(schemaBeforeThreadNoteCleanup),
    );
    expect(
      (await database.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });

  it("takes writes from the API before it and the API after it", async () => {
    await database
      .prepare(
        "UPDATE thread_notes SET state = 'done', completed_at = 1700000000400 WHERE id = 'record-open'",
      )
      .run();
    await database
      .prepare(
        `INSERT INTO thread_notes (id, user_id, thread_id, body, created_at, updated_at)
         VALUES ('record-new', ?, 'record-thread', 'Booked for Monday', 1700000000500, 1700000000500)`,
      )
      .bind(recorder.actorId)
      .run();
    expect(
      await database
        .prepare(
          "SELECT state, completed_at FROM thread_notes WHERE id = 'record-new'",
        )
        .first(),
    ).toEqual({ state: "open", completed_at: null });

    const listed = await read<ThreadNote[]>(
      "/v1/threads/record-thread/notes",
      recorder.cookie,
    );
    expect(listed.map((note) => note.body)).toEqual([
      "Booked for Monday",
      "Old consultation",
      "Clinic opens at nine",
    ]);
  });
});

const NOTE_DATE = Date.UTC(2030, 10, 5, 9);

describe("0008: Standalone Notes gain a Repeat", () => {
  it("adds only a nullable repeat column, keeping every saved Note", async () => {
    expect(notesBeforeRepeat.length).toBeGreaterThan(3);
    expect(await readNotes()).toEqual(
      notesBeforeRepeat.map((row) => ({ ...row, repeat: null })),
    );
    const columns = await readColumns("notes");
    expect(columns.slice(0, -1)).toEqual(noteColumnsBeforeRepeat);
    expect(columns.at(-1)).toMatchObject({
      name: "repeat",
      type: "TEXT",
      notnull: 0,
      dflt_value: null,
      pk: 0,
    });
    const unrelated = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.name !== "notes");
    expect(unrelated(schemaAfterRepeat)).toEqual(unrelated(schemaBeforeRepeat));
  });

  it("reads every existing Note as not repeating", async () => {
    const open = await read<Note[]>("/v1/notes", repeater.cookie);
    expect(open).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Pay the utility bill",
          followUp: NOTE_DATE,
        }),
        expect.objectContaining({ body: "Gift ideas" }),
      ]),
    );
    const done = await read<{ entries: Note[] }>(
      "/v1/notes/done",
      repeater.cookie,
    );
    expect(done.entries).toEqual([
      expect.objectContaining({ body: "Renew insurance", followUp: NOTE_DATE }),
    ]);
    for (const note of [...open, ...done.entries]) {
      expect(note).not.toHaveProperty("repeat");
    }
  });
});

// Check preservation before the workflow tests below change these rows.
describe("0007: remove the retired Thread Follow-up column", () => {
  it("drops only follow_up and preserves every other saved value and schema object", async () => {
    expect(beforeCleanup.threads.some((row) => row.moves_json === null)).toBe(
      true,
    );
    expect(beforeCleanup.threads.some((row) => row.moves_json !== null)).toBe(
      true,
    );
    expect(retainedFollowUps.some((row) => row.follow_up !== null)).toBe(true);
    expect(beforeCleanup.notes.length).toBeGreaterThan(0);
    expect(afterCleanup).toEqual(beforeCleanup);
    const columns = columnsAfterCleanup;
    // SQLite renumbers column positions after a drop; every other attribute stays.
    expect(columns.map(({ cid: _position, ...column }) => column)).toEqual(
      columnsBeforeCleanup
        .filter((column) => column.name !== "follow_up")
        .map(({ cid: _position, ...column }) => column),
    );
    const unrelated = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => row.name !== "threads");
    expect(
      unrelated(schemaBeforeCleanup).every(
        (row) => !/\bfollow_up\b/.test(String(row.sql)),
      ),
    ).toBe(true);
    expect(unrelated(schemaAfterCleanup)).toEqual(
      unrelated(schemaBeforeCleanup),
    );
    expect(
      (await database.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });
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
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Next move set",
      createdAt: 1_600_000_000_000,
    });
    expect(await storedFocus(checkup.thread._id)).toBe(
      checkup.thread.tasks?.[0]?._id,
    );
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(checkup.thread._id)
        .first<number>("revision"),
    ).toBe(8);
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(gate.thread._id)
        .first<number>("revision"),
    ).toBe(2);
    expect(checkup.area?._id).toBe("area-health");
    expect(gate.thread).toMatchObject({
      areaId: "area-home",
      state: "resolved",
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

    expect(
      activity.entries.map((entry) => entry.threadNoteId ?? entry._id),
    ).toEqual(["note-1", "log-1"]);
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
    expect(await storedFocus(thread._id)).toBe(thread.tasks?.[0]?._id);
    expect(new Set(thread.tasks?.map((task) => task._id)).size).toBe(4);
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(thread._id)
        .first<number>("revision"),
    ).toBe(4);
  });

  it("gives a Thread with only a Next Move one focused Task", async () => {
    const thread = await threadOf("single-00000000");

    expect(thread.tasks).toEqual([
      { _id: expect.any(String), text: "Email the landlord" },
    ]);
    expect(await storedFocus(thread._id)).toBe(thread.tasks?.[0]?._id);
  });

  it("brings a Thread with neither through with no Tasks and no focus", async () => {
    for (const slug of ["plain-00000000", "finished-00000000"]) {
      const thread = await threadOf(slug);
      expect(thread).not.toHaveProperty("tasks");
      expect(await storedFocus(thread._id)).toBeNull();
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
        body: JSON.stringify({
          expectedOccurrence: thread.tasks?.[0]?.date ?? null,
        }),
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
    expect(await storedFocus(thread._id)).toBe("call");
    expect(thread.tasks?.[2]?._id).toMatch(/^[0-9a-f]{32}$/);
    // Changed Threads move to a new revision; untouched ones keep theirs.
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(thread._id)
        .first<number>("revision"),
    ).toBe(7);
  });

  it("starts the Tasks of a Thread that had none, with a date-only Task", async () => {
    const thread = await threadOf("fold-bare-dated-00000000");

    expect(thread.tasks).toEqual([
      { _id: expect.any(String), text: "Follow up", date: FOLLOW_UP_DAY },
    ]);
    expect(await storedFocus(thread._id)).toBeNull();
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(thread._id)
        .first<number>("revision"),
    ).toBe(7);
  });

  it("leaves a Thread without a Follow-up date as it was", async () => {
    const thread = await threadOf("fold-undated-00000000");

    expect(thread.tasks).toEqual([
      { _id: "email", text: "Email the landlord" },
    ]);
    expect(await storedFocus(thread._id)).toBe("email");
    expect(thread).not.toHaveProperty("followUp");
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(thread._id)
        .first<number>("revision"),
    ).toBe(6);
  });

  it("leaves a Resolved Thread as it was", async () => {
    const thread = await threadOf("fold-finished-00000000");

    expect(thread).not.toHaveProperty("tasks");
    expect(thread).not.toHaveProperty("followUp");
    expect(thread.state).toBe("resolved");
    expect(
      await env.MIGRATION_DB.prepare(
        "SELECT revision FROM threads WHERE id = ?",
      )
        .bind(thread._id)
        .first<number>("revision"),
    ).toBe(6);
  });

  it("retains the legacy column through 0006 and every Activity Log entry", async () => {
    expect(retainedFollowUps).toEqual([
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
