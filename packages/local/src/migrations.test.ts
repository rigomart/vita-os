import { createClient, type Client, type InValue } from "@libsql/client";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  migrateDatabase,
  MigrationFailedError,
  UnknownMigrationsError,
  UnrecognizedDatabaseError,
} from "./migrations.ts";

const REPO_MIGRATIONS = fileURLToPath(
  new URL("../../../apps/api/migrations", import.meta.url),
);

let directory: string;
let databasePath: string;
let clients: Client[];

beforeEach(async () => {
  // A space, as in macOS's "Application Support".
  directory = await mkdtemp(join(tmpdir(), "vita local "));
  databasePath = join(directory, "vita.db");
  clients = [];
});

afterEach(async () => {
  for (const client of clients) client.close();
  await rm(directory, { recursive: true, force: true });
});

async function repoMigrations(): Promise<string[]> {
  return (await readdir(REPO_MIGRATIONS))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** A migrations directory holding the repository's files through `last`, plus `extra`. */
async function migrationsDirectory(
  options: { through?: number; extra?: Record<string, string> } = {},
): Promise<string> {
  const target = await mkdtemp(join(directory, "migrations-"));
  for (const name of await repoMigrations()) {
    if (
      options.through !== undefined &&
      Number.parseInt(name, 10) > options.through
    ) {
      continue;
    }
    await copyFile(join(REPO_MIGRATIONS, name), join(target, name));
  }
  for (const [name, sql] of Object.entries(options.extra ?? {})) {
    await writeFile(join(target, name), sql);
  }
  return target;
}

function open(path = databasePath): Client {
  const client = createClient({
    url: pathToFileURL(path).href,
    concurrency: 1,
  });
  clients.push(client);
  return client;
}

async function rows(client: Client, sql: string, args: InValue[] = []) {
  const result = await client.execute({ sql, args });
  return result.rows.map((row) => ({ ...row }));
}

async function recorded(client: Client): Promise<string[]> {
  return (await rows(client, "SELECT name FROM d1_migrations ORDER BY id")).map(
    (row) => String(row.name),
  );
}

async function schema(client: Client) {
  return rows(
    client,
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
  );
}

const PRODUCT_TABLES = [
  "areas",
  "threads",
  "activity_log_entries",
  "notes",
  "thread_notes",
] as const;

async function snapshot(client: Client) {
  const tables = (
    await rows(
      client,
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'd1_migrations' ORDER BY name",
    )
  ).map((row) => String(row.name));
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        await rows(client, `SELECT * FROM ${table} ORDER BY id`),
      ]),
    ),
  );
}

async function backupsOf(path: string): Promise<string[]> {
  const prefix = `${basename(path)}.before-`;
  return (await readdir(dirname(path)))
    .filter((name) => name.startsWith(prefix))
    .map((name) => join(dirname(path), name));
}

async function migrateWith(migrationsDir: string) {
  return migrateDatabase({ databasePath, migrationsDirectory: migrationsDir });
}

async function migrateThrough(stage: number) {
  return migrateWith(await migrationsDirectory({ through: stage }));
}

describe("a fresh file", () => {
  it("applies every migration, records them as Wrangler does, and takes no copy", async () => {
    const all = await repoMigrations();
    const result = await migrateDatabase({
      databasePath,
      migrationsDirectory: REPO_MIGRATIONS,
    });
    expect(result).toEqual({ applied: all, backupPath: null });

    const client = open();
    expect(await recorded(client)).toEqual(all);
    expect(
      (await rows(client, "PRAGMA table_info(d1_migrations)")).map((column) => [
        column.name,
        column.type,
      ]),
    ).toEqual([
      ["id", "INTEGER"],
      ["name", "TEXT"],
      ["applied_at", "TIMESTAMP"],
    ]);
    for (const row of await rows(
      client,
      "SELECT applied_at FROM d1_migrations",
    )) {
      expect(row.applied_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    }
    const tables = (await schema(client))
      .filter((row) => row.type === "table")
      .map((row) => row.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "user",
        "session",
        "account",
        "verification",
        ...PRODUCT_TABLES,
      ]),
    );
    expect(
      (await rows(client, "PRAGMA table_info(notes)")).map(
        (column) => column.name,
      ),
    ).toContain("repeat");
    expect(await rows(client, "PRAGMA foreign_key_check")).toEqual([]);
    expect(await backupsOf(databasePath)).toEqual([]);
  });

  it("does nothing on a second run", async () => {
    await migrateDatabase({
      databasePath,
      migrationsDirectory: REPO_MIGRATIONS,
    });
    const before = await readFile(databasePath);
    expect(
      await migrateDatabase({
        databasePath,
        migrationsDirectory: REPO_MIGRATIONS,
      }),
    ).toEqual({ applied: [], backupPath: null });
    expect(await readFile(databasePath)).toEqual(before);
    expect(await backupsOf(databasePath)).toEqual([]);
  });
});

// Upgrades: migrate through stage k, write rows valid at k, then run the rest.

const OWNER = "owner-1";
const CREATED = 1_600_000_000_000;
const ACTIVITY = 1_700_000_000_000;
const FOLLOW_UP = Date.UTC(2030, 10, 5, 9);

async function insert(
  client: Client,
  table: string,
  row: Record<string, InValue>,
) {
  const columns = Object.keys(row);
  await client.execute({
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    args: Object.values(row),
  });
}

/** Writes rows valid at `stage`. */
async function seed(client: Client, stage: number) {
  await insert(client, "user", {
    id: OWNER,
    name: "Owner",
    email: "owner@example.com",
    emailVerified: 1,
    createdAt: CREATED,
    updatedAt: CREATED,
  });
  await insert(client, "session", {
    id: "session-1",
    expiresAt: ACTIVITY,
    token: "token",
    createdAt: CREATED,
    updatedAt: CREATED,
    userId: OWNER,
  });
  if (stage < 2) return;

  for (const area of [
    {
      id: "area-health",
      name: "Health",
      slug: "health",
      icon: "HeartPulse",
      sort_order: 1,
    },
    {
      id: "area-home",
      name: "Home",
      slug: "home",
      icon: "Home",
      sort_order: 0,
    },
  ]) {
    await insert(client, "areas", {
      ...area,
      user_id: OWNER,
      created_at: CREATED,
      ...(stage < 4
        ? { standard: "Checkups are current", condition: "critical" }
        : {}),
    });
  }

  const token = stage < 3 ? "last_completion_token" : "last_change_token";
  const openThread: Record<string, InValue> = {
    id: "thread-open",
    user_id: OWNER,
    area_id: "area-health",
    title: "Book checkup",
    slug: "book-checkup",
    summary: "Annual",
    sort_order: 3,
    state: "open",
    last_activity_at: ACTIVITY,
    last_activity_content: "Next move set",
    created_at: CREATED,
    revision: 7,
    [token]: "token-7",
  };
  const resolvedThread: Record<string, InValue> = {
    id: "thread-resolved",
    user_id: OWNER,
    area_id: stage < 4 ? "area-home" : null,
    title: "Fix the gate",
    slug: "fix-the-gate",
    sort_order: 4,
    state: "resolved",
    created_at: CREATED + 1,
    revision: 2,
  };
  if (stage < 5) {
    openThread.next_move = "Call clinic";
    openThread.up_next_json = JSON.stringify(["Book appointment"]);
  } else {
    openThread.moves_json = JSON.stringify([
      { id: "move-call", text: "Call clinic" },
      { id: "move-book", text: "Book appointment" },
    ]);
    openThread.focused_move_id = "move-call";
  }
  if (stage < 7) {
    openThread.follow_up = FOLLOW_UP;
    resolvedThread.follow_up = FOLLOW_UP;
  }
  await insert(client, "threads", openThread);
  await insert(client, "threads", resolvedThread);

  await insert(client, "activity_log_entries", {
    id: "log-1",
    user_id: OWNER,
    thread_id: "thread-open",
    type: stage < 5 ? "next_move_change" : "move_completed",
    content: 'Next move set to "Call clinic"',
    new_value: "Call clinic",
    created_at: ACTIVITY,
  });
  if (stage < 3) return;

  await insert(client, "thread_notes", {
    id: "thread-note-1",
    user_id: OWNER,
    thread_id: "thread-open",
    body: "Clinic opens at nine",
    state: "open",
    created_at: ACTIVITY,
    updated_at: ACTIVITY,
  });
  await insert(client, "notes", {
    id: "note-1",
    user_id: OWNER,
    body: "Renew insurance",
    attention_date: FOLLOW_UP,
    state: "done",
    completed_at: ACTIVITY,
    created_at: ACTIVITY,
    updated_at: ACTIVITY,
  });
}

/** What `seed(stage)` reads as once every migration has run. */
async function expectUpgraded(client: Client, stage: number) {
  expect(await rows(client, "SELECT id, email FROM user")).toEqual([
    { id: OWNER, email: "owner@example.com" },
  ]);
  expect(await rows(client, "SELECT id, userId FROM session")).toEqual([
    { id: "session-1", userId: OWNER },
  ]);
  if (stage < 2) {
    for (const table of PRODUCT_TABLES) {
      expect(await rows(client, `SELECT * FROM ${table}`)).toEqual([]);
    }
    return;
  }

  expect(await rows(client, "SELECT * FROM areas ORDER BY id")).toEqual([
    {
      id: "area-health",
      user_id: OWNER,
      name: "Health",
      slug: "health",
      icon: "HeartPulse",
      sort_order: 1,
      created_at: CREATED,
    },
    {
      id: "area-home",
      user_id: OWNER,
      name: "Home",
      slug: "home",
      icon: "Home",
      sort_order: 0,
      created_at: CREATED,
    },
  ]);

  const [open, resolved] = await rows(
    client,
    "SELECT * FROM threads ORDER BY id",
  );
  const moves = JSON.parse(String(open!.moves_json)) as {
    id: string;
    text: string;
    date?: number;
  }[];
  expect(moves.map(({ id: _id, ...move }) => move)).toEqual([
    { text: "Call clinic" },
    { text: "Book appointment" },
    // 0006 folds an open Thread's Follow-up into a Task at the end.
    ...(stage < 6 ? [{ text: "Follow up", date: FOLLOW_UP }] : []),
  ]);
  expect(new Set(moves.map((move) => move.id)).size).toBe(moves.length);
  if (stage >= 5) {
    expect(moves.slice(0, 2).map((move) => move.id)).toEqual([
      "move-call",
      "move-book",
    ]);
  }
  expect(open).toEqual({
    id: "thread-open",
    user_id: OWNER,
    area_id: "area-health",
    title: "Book checkup",
    slug: "book-checkup",
    summary: "Annual",
    sort_order: 3,
    state: "open",
    last_activity_at: ACTIVITY,
    last_activity_content: "Next move set",
    created_at: CREATED,
    // 0006 raises the revision of each Thread it changes.
    revision: stage < 6 ? 8 : 7,
    last_change_token: "token-7",
    moves_json: open!.moves_json,
    // 0005 focuses what was the Next Move.
    focused_move_id: moves[0]!.id,
  });
  expect(resolved).toEqual({
    id: "thread-resolved",
    user_id: OWNER,
    area_id: stage < 4 ? "area-home" : null,
    title: "Fix the gate",
    slug: "fix-the-gate",
    summary: null,
    sort_order: 4,
    state: "resolved",
    last_activity_at: null,
    last_activity_content: null,
    created_at: CREATED + 1,
    revision: 2,
    last_change_token: null,
    moves_json: null,
    focused_move_id: null,
  });

  expect(await rows(client, "SELECT * FROM activity_log_entries")).toEqual([
    {
      id: "log-1",
      user_id: OWNER,
      thread_id: "thread-open",
      type: stage < 5 ? "next_move_change" : "move_completed",
      content: 'Next move set to "Call clinic"',
      previous_value: null,
      new_value: "Call clinic",
      created_at: ACTIVITY,
    },
  ]);
  if (stage < 3) return;

  expect(await rows(client, "SELECT * FROM thread_notes")).toEqual([
    {
      id: "thread-note-1",
      user_id: OWNER,
      thread_id: "thread-open",
      body: "Clinic opens at nine",
      state: "open",
      completed_at: null,
      created_at: ACTIVITY,
      updated_at: ACTIVITY,
    },
  ]);
  expect(await rows(client, "SELECT * FROM notes")).toEqual([
    {
      id: "note-1",
      user_id: OWNER,
      body: "Renew insurance",
      attention_date: FOLLOW_UP,
      state: "done",
      completed_at: ACTIVITY,
      created_at: ACTIVITY,
      updated_at: ACTIVITY,
      repeat: null,
    },
  ]);
}

describe("an upgrade keeps the data", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "from %i to the latest, after copying the file",
    async (stage) => {
      const all = await repoMigrations();
      await migrateThrough(stage);
      const before = open();
      await seed(before, stage);
      const seeded = await snapshot(before);
      const seededSchema = await schema(before);
      before.close();

      const result = await migrateDatabase({
        databasePath,
        migrationsDirectory: REPO_MIGRATIONS,
      });
      const pending = all.slice(stage);
      expect(result.applied).toEqual(pending);
      expect(result.backupPath).toMatch(
        new RegExp(
          `^${escape(databasePath)}\\.before-${escape(pending[0]!.replace(/\.sql$/, ""))}-\\d{4}-\\d\\d-\\d\\dT\\d\\d-\\d\\d-\\d\\d-\\d{3}Z$`,
        ),
      );
      expect(await backupsOf(databasePath)).toEqual([result.backupPath]);

      const after = open();
      expect(await recorded(after)).toEqual(all);
      await expectUpgraded(after, stage);
      expect(await rows(after, "PRAGMA foreign_key_check")).toEqual([]);

      // The upgraded file has exactly the schema a fresh one gets.
      const fresh = join(directory, "fresh.db");
      await migrateDatabase({
        databasePath: fresh,
        migrationsDirectory: REPO_MIGRATIONS,
      });
      expect(await schema(after)).toEqual(await schema(open(fresh)));

      // The copy is the file as it was before the upgrade.
      const copy = open(result.backupPath!);
      expect(await snapshot(copy)).toEqual(seeded);
      expect(await schema(copy)).toEqual(seededSchema);
      expect(await recorded(copy)).toEqual(all.slice(0, stage));
    },
  );
});

function escape(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("a failing migration", () => {
  it("rolls that migration back, keeps earlier ones and the copy, and names it", async () => {
    await migrateThrough(9);
    const client = open();
    await seed(client, 9);
    const seeded = await snapshot(client);
    const seededSchema = await schema(client);
    client.close();

    const migrations = await migrationsDirectory({
      extra: {
        "0010_works.sql": "CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL);",
        // DDL and a write succeed before the third statement fails.
        "0011_breaks.sql": `CREATE TABLE half_done (id TEXT);
UPDATE notes SET body = 'changed';
INSERT INTO no_such_table VALUES (1);`,
        "0012_never.sql": "CREATE TABLE never (id TEXT);",
      },
    });
    const error = await migrateWith(migrations).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(MigrationFailedError);
    const failure = error as MigrationFailedError;
    expect(failure.migration).toBe("0011_breaks.sql");
    expect(failure.applied).toEqual(["0010_works.sql"]);
    expect(failure.message).toContain("0011_breaks.sql");
    expect(failure.message).toContain("no such table: no_such_table");
    expect(failure.backupPath).toContain(".before-0010_works-");

    const after = open();
    expect(await recorded(after)).toEqual([
      ...(await repoMigrations()),
      "0010_works.sql",
    ]);
    expect(await snapshot(after)).toEqual({ ...seeded, tags: [] });
    const tableNames = (await schema(after)).map((row) => row.name);
    expect(tableNames).not.toContain("half_done");
    expect(tableNames).not.toContain("never");

    expect(await backupsOf(databasePath)).toEqual([failure.backupPath]);
    const copy = open(failure.backupPath!);
    expect(await snapshot(copy)).toEqual(seeded);
    expect(await schema(copy)).toEqual(seededSchema);

    // Once the file is fixed, the next run picks up where this one stopped.
    await writeFile(
      join(migrations, "0011_breaks.sql"),
      "CREATE TABLE half_done (id TEXT);",
    );
    const retry = await migrateWith(migrations);
    expect(retry.applied).toEqual(["0011_breaks.sql", "0012_never.sql"]);
  });

  it("on a fresh file leaves no history table behind", async () => {
    const migrations = await mkdtemp(join(directory, "migrations-"));
    await writeFile(
      join(migrations, "0001_broken.sql"),
      "CREATE TABLE ok (id TEXT); nonsense;",
    );
    await expect(migrateWith(migrations)).rejects.toBeInstanceOf(
      MigrationFailedError,
    );
    expect(await schema(open())).toEqual([]);
  });
});

describe("a database this app can't vouch for is refused, unchanged", () => {
  it("when a newer app applied a migration this one doesn't know", async () => {
    await migrateThrough(9);
    const client = open();
    await seed(client, 9);
    await client.execute(
      "INSERT INTO d1_migrations (name) VALUES ('0010_future.sql')",
    );
    client.close();
    const before = await readFile(databasePath);

    const error = await migrateWith(
      await migrationsDirectory({
        extra: { "0011_also_new.sql": "CREATE TABLE x (id TEXT);" },
      }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnknownMigrationsError);
    expect((error as UnknownMigrationsError).unknownMigrations).toEqual([
      "0010_future.sql",
    ]);
    expect(await readFile(databasePath)).toEqual(before);
    expect(await backupsOf(databasePath)).toEqual([]);
  });

  it("when the file has tables but no migration history", async () => {
    const client = open();
    await client.execute("CREATE TABLE someone_elses (id TEXT)");
    client.close();
    const before = await readFile(databasePath);

    await expect(
      migrateDatabase({ databasePath, migrationsDirectory: REPO_MIGRATIONS }),
    ).rejects.toBeInstanceOf(UnrecognizedDatabaseError);
    expect(await readFile(databasePath)).toEqual(before);
    expect(await backupsOf(databasePath)).toEqual([]);
  });
});

describe("foreign keys during migrations, as on D1", () => {
  const PARENT_AND_CHILD = `CREATE TABLE parent (id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE child (id TEXT PRIMARY KEY NOT NULL, parent_id TEXT NOT NULL REFERENCES parent(id));`;

  async function run(extra: Record<string, string>) {
    const migrations = await mkdtemp(join(directory, "migrations-"));
    await writeFile(join(migrations, "0001_tables.sql"), PARENT_AND_CHILD);
    for (const [name, sql] of Object.entries(extra)) {
      await writeFile(join(migrations, name), sql);
    }
    return migrateWith(migrations);
  }

  it("are enforced", async () => {
    await expect(
      run({ "0002_orphan.sql": "INSERT INTO child VALUES ('c', 'missing');" }),
    ).rejects.toThrow(/0002_orphan\.sql.*FOREIGN KEY constraint failed/);
    expect(await rows(open(), "SELECT * FROM child")).toEqual([]);
  });

  it("can't be switched off by a migration", async () => {
    await expect(
      run({
        "0002_off.sql":
          "PRAGMA foreign_keys = OFF; INSERT INTO child VALUES ('c', 'missing');",
      }),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it("can be deferred to the end of the migration with defer_foreign_keys", async () => {
    await run({
      "0002_deferred.sql": `PRAGMA defer_foreign_keys = on;
INSERT INTO child VALUES ('c', 'p');
INSERT INTO parent VALUES ('p');`,
    });
    expect(await rows(open(), "SELECT * FROM child")).toEqual([
      { id: "c", parent_id: "p" },
    ]);
  });

  it("still fail a deferred migration that leaves a violation, rolling it back", async () => {
    const error = await run({
      "0002_left_orphan.sql": `PRAGMA defer_foreign_keys = on;
INSERT INTO parent VALUES ('kept-out');
INSERT INTO child VALUES ('c', 'missing');`,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MigrationFailedError);
    expect((error as Error).message).toMatch(/FOREIGN KEY constraint failed/);
    const client = open();
    expect(await rows(client, "SELECT * FROM parent")).toEqual([]);
    expect(await recorded(client)).toEqual(["0001_tables.sql"]);
  });

  it("let 0004 rebuild threads without losing their Activity Log or Thread Notes", async () => {
    await migrateThrough(3);
    const client = open();
    await seed(client, 3);
    client.close();

    await migrateThrough(4);
    const after = open();
    expect(
      await rows(after, "SELECT id, thread_id FROM activity_log_entries"),
    ).toEqual([{ id: "log-1", thread_id: "thread-open" }]);
    expect(await rows(after, "SELECT id, thread_id FROM thread_notes")).toEqual(
      [{ id: "thread-note-1", thread_id: "thread-open" }],
    );
    // The children now reference the rebuilt `threads`, and cascade from it.
    expect(
      (await rows(after, "PRAGMA foreign_key_list(thread_notes)")).map(
        (key) => [key.table, key.on_delete],
      ),
    ).toEqual([["threads", "CASCADE"]]);
    expect(await rows(after, "PRAGMA foreign_key_check")).toEqual([]);
  });
});

describe("listing migrations", () => {
  it("orders by leading number, as Wrangler does, and ignores other files", async () => {
    const migrations = await mkdtemp(join(directory, "migrations-"));
    await mkdir(join(migrations, "meta"));
    await writeFile(join(migrations, "meta", "0000_snapshot.sql"), "nonsense;");
    await writeFile(
      join(migrations, "10_second.sql"),
      "CREATE TABLE b (id TEXT);",
    );
    await writeFile(
      join(migrations, "9_first.sql"),
      "CREATE TABLE a (id TEXT);",
    );
    await writeFile(join(migrations, ".hidden.sql"), "nonsense;");
    await writeFile(join(migrations, "notes.md"), "nonsense;");

    expect((await migrateWith(migrations)).applied).toEqual([
      "9_first.sql",
      "10_second.sql",
    ]);
  });
});

describe("the copy before migrating", () => {
  async function databaseAt(stage: number) {
    await migrateThrough(stage);
    const client = open();
    await seed(client, stage);
    client.close();
    return readFile(databasePath);
  }

  it("never replaces a file already at its name, and changes nothing", async () => {
    const before = await databaseAt(7);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 9, 15, 9, 30));
    const taken = `${databasePath}.before-0008_repeating_notes-2026-10-15T09-30-00-000Z`;
    await writeFile(taken, "someone else's file");
    try {
      await expect(
        migrateDatabase({ databasePath, migrationsDirectory: REPO_MIGRATIONS }),
      ).rejects.toThrow(/already exists/);
    } finally {
      vi.useRealTimers();
    }
    expect(await readFile(taken, "utf8")).toBe("someone else's file");
    expect(await readFile(databasePath)).toEqual(before);
  });

  it("that fails leaves no copy behind and changes nothing", async () => {
    const before = await databaseAt(7);
    // SQLite can read the file but can't create a copy next to it.
    await chmod(directory, 0o555);
    try {
      await expect(
        migrateDatabase({ databasePath, migrationsDirectory: REPO_MIGRATIONS }),
      ).rejects.toThrow(/SQLITE_CANTOPEN.*before-0008_repeating_notes/);
    } finally {
      await chmod(directory, 0o755);
    }
    expect(await backupsOf(databasePath)).toEqual([]);
    expect(await readFile(databasePath)).toEqual(before);
  });
});
