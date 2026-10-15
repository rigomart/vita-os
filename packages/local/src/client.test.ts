import type { Client } from "@libsql/client";
import type {
  ApplicationClient,
  AreaIcon,
  OperationResult,
  TaskId,
  ThreadNoteId,
} from "@vita-os/contracts";

import { describeApplicationClient } from "@vita-os/contracts/testing";
import {
  activityLogEntries,
  areas,
  threadNotes,
  threads,
} from "@vita-os/operations/internal/platform/sqlite/schema";
import { eq, sql } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { LocalDatabase } from "./open.ts";

import { createLocalApplicationClient, LOCAL_OWNER_ID } from "./client.ts";
import { openLocalDatabase } from "./open.ts";

const MIGRATIONS = fileURLToPath(
  new URL("../../../apps/api/migrations", import.meta.url),
);

let directory: string;
const opened: LocalDatabase[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "vita local client "));
});

afterAll(async () => {
  for (const local of opened) local.close();
  await rm(directory, { recursive: true, force: true });
});

afterEach(() => vi.restoreAllMocks());

/** A fresh, migrated database file of its own. */
async function freshDatabase(): Promise<LocalDatabase> {
  const databaseDirectory = await mkdtemp(join(directory, "db-"));
  const local = await openLocalDatabase({
    databasePath: join(databaseDirectory, "vita.db"),
    migrationsDirectory: MIGRATIONS,
  });
  opened.push(local);
  return local;
}

async function value<T>(operation: Promise<OperationResult<T>>): Promise<T> {
  const result = await operation;
  if (!result.ok)
    throw new Error(`Operation failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Every answer must survive a JSON round trip, as it would over HTTP. */
function asOverJson(client: ApplicationClient): ApplicationClient {
  return new Proxy(client, {
    get(target, key) {
      const method = Reflect.get(target, key) as unknown;
      // Not `then`, or awaiting the client would treat it as a promise.
      if (typeof method !== "function") return method;
      return async (...args: unknown[]) => {
        const result = await method(...args);
        expect(result).toStrictEqual(JSON.parse(JSON.stringify(result)));
        return result;
      };
    },
  });
}

describeApplicationClient("The local client", async () =>
  asOverJson(
    createLocalApplicationClient({ db: (await freshDatabase()).database }),
  ),
);

describe("the local client", () => {
  it("stores everything under the one local owner", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    await value(client.createArea({ name: "Home", icon: "Home" }));
    await value(client.createThread({ title: "Fix the gate" }));

    expect(
      await database.drizzle.select({ owner: areas.user_id }).from(areas),
    ).toEqual([{ owner: LOCAL_OWNER_ID }]);
    expect(
      await database.drizzle.select({ owner: threads.user_id }).from(threads),
    ).toEqual([{ owner: LOCAL_OWNER_ID }]);
  });

  it("treats an undefined property as absent, as JSON does", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    const area = await value(client.createArea({ name: "Home", icon: "Home" }));
    const thread = await value(
      client.createThread({ title: "Fix the gate", areaId: area._id }),
    );

    const retitled = await value(
      client.updateThread({
        threadId: thread._id,
        title: "Fix it",
        areaId: undefined,
      }),
    );
    expect(retitled.areaId).toBe(area._id);
  });

  it("refuses what HTTP refuses, storing nothing", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    const refusal = (message: string) => ({
      ok: false,
      error: { code: "validation", message, retryable: false },
    });

    for (const followUp of [1.5, -5e15]) {
      await expect(
        client.createNote({ body: "Pay rent", followUp }),
      ).resolves.toEqual(refusal("Invalid date"));
    }
    await expect(
      client.createArea({ name: "A", icon: "NotAnIcon" as AreaIcon }),
    ).resolves.toEqual(refusal("Invalid Area icon"));
    const area = await value(client.createArea({ name: "Home", icon: "Home" }));
    await expect(
      client.updateArea({ areaId: area._id, icon: "NotAnIcon" as AreaIcon }),
    ).resolves.toEqual(refusal("Invalid Area icon"));

    await expect(client.listOpenNotes()).resolves.toEqual({
      ok: true,
      value: [],
    });
    await expect(client.listAreas()).resolves.toEqual({
      ok: true,
      value: [area],
    });
  });

  it("refuses an oversized page in each history's words", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    const thread = await value(client.createThread({ title: "Fix the gate" }));
    const refusal = (message: string) => ({
      ok: false,
      error: { code: "validation", message, retryable: false },
    });

    await expect(client.getDoneNotePage({ limit: 51 })).resolves.toEqual(
      refusal("Invalid pagination."),
    );
    await expect(
      client.getDoneThreadNotePage({ threadId: thread._id, limit: 0 }),
    ).resolves.toEqual(refusal("Invalid pagination."));
    await expect(
      client.getThreadActivityPage({ threadId: thread._id, limit: 1.5 }),
    ).resolves.toEqual(refusal("Invalid Activity Log pagination."));
    await expect(client.getDoneNotePage({ limit: 50 })).resolves.toMatchObject({
      ok: true,
    });
  });

  it("reports an operation on a closed database as unexpected, and says why", async () => {
    const local = await freshDatabase();
    const causes: unknown[] = [];
    const client = createLocalApplicationClient({
      db: local.database,
      onUnexpected: (cause) => causes.push(cause),
    });
    local.close();

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected error.",
        retryable: false,
      },
    });
    expect(causes).toHaveLength(1);
  });
});

describe("atomic writes on libsql", () => {
  it("leaves nothing behind when a completion's batch hits a primary-key collision", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    const thread = await value(client.createThread({ title: "Fix the tap" }));
    for (const [taskId, text] of [
      ["a", "Buy a cartridge"],
      ["b", "Fit it"],
    ] as const) {
      await value(
        client.addTask({
          threadId: thread._id,
          taskId: taskId as TaskId,
          text,
        }),
      );
    }
    await value(
      client.completeTask({
        threadId: thread._id,
        taskId: "a" as TaskId,
        expectedOccurrence: null,
      }),
    );
    const [existing] = await database.drizzle
      .select({ id: activityLogEntries.id })
      .from(activityLogEntries);

    const stored = async () => ({
      threads: await database.drizzle.select().from(threads),
      log: await database.drizzle.select().from(activityLogEntries),
      threadNotes: await database.drizzle.select().from(threadNotes),
    });
    const before = await stored();
    expect(before.log).toHaveLength(1);

    const causes: unknown[] = [];
    const colliding = createLocalApplicationClient({
      db: database,
      // Every ID it mints is the existing Activity Log entry's.
      clock: { now: () => Date.now(), newId: () => existing!.id },
      onUnexpected: (cause) => causes.push(cause),
    });
    const answer = await colliding.completeTask({
      threadId: thread._id,
      taskId: "b" as TaskId,
      expectedOccurrence: null,
      note: { id: crypto.randomUUID() as ThreadNoteId, body: "Fitted" },
    });

    expect(answer).toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected error.",
        retryable: false,
      },
    });
    expect(causes).toHaveLength(1);
    expect(String(causes[0])).toContain(
      "UNIQUE constraint failed: activity_log_entries.id",
    );
    // The Task, the revision, the log and the Note are all as they were.
    expect(await stored()).toEqual(before);
    expect(before.threads[0]!.moves_json).toContain('"b"');
  });
});

describe("slug collisions on libsql", () => {
  it("are recognized and retried with a new slug", async () => {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({
      db: database,
      // IDs from elsewhere, so only slugs read the mocked randomness.
      clock: { now: () => Date.now(), newId: () => crypto.randomUUID() },
    });
    const random = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((array) => {
        (array as Uint8Array).fill(0);
        return array;
      });
    const first = await value(client.createThread({ title: "Repeated" }));
    random.mockImplementation((array) => {
      (array as Uint8Array).fill(1);
      return array;
    });
    random.mockImplementationOnce((array) => {
      (array as Uint8Array).fill(0);
      return array;
    });

    const second = await value(client.createThread({ title: "Repeated" }));

    expect(first.slug).toBe("repeated-00000000");
    expect(second.slug).toBe("repeated-01010101");
  });
});

describe("the libsql database adapter", () => {
  async function seededDatabase() {
    const { database } = await freshDatabase();
    const client = createLocalApplicationClient({ db: database });
    await value(client.createArea({ name: "Home", icon: "Home" }));
    const [area] = await database.drizzle.select().from(areas);
    return { database, area: area! };
  }

  it("counts the rows a statement wrote, alone or in a batch", async () => {
    const { database, area } = await seededDatabase();
    const db = database.drizzle;

    expect(
      database.changes(
        await db
          .update(areas)
          .set({ name: "House" })
          .where(eq(areas.id, area.id))
          .run(),
      ),
    ).toBe(1);
    const [renamed, missed] = await db.batch([
      db.update(areas).set({ name: "Home" }).where(eq(areas.id, area.id)),
      db.delete(areas).where(eq(areas.id, "nothing")),
    ]);
    expect(database.changes(renamed)).toBe(1);
    expect(database.changes(missed)).toBe(0);
    expect(() => database.changes(undefined)).toThrow(/rowsAffected/);
    // libsql reports 0 for a statement that returns rows, whatever it wrote.
    const raw = await (db as unknown as { $client: Client }).$client.execute(
      "UPDATE areas SET name = 'Home' RETURNING id",
    );
    expect(raw.rowsAffected).toBe(0);
    expect(() => database.changes(raw)).toThrow(/RETURNING/);
  });

  it("recognizes a unique violation by its columns, alone or in a batch", async () => {
    const { database, area } = await seededDatabase();
    const db = database.drizzle;
    const duplicate = () => db.insert(areas).values({ ...area, id: "other" });

    const alone = await duplicate().catch((error: unknown) => error);
    expect(database.isUniqueViolation(alone, "areas.user_id, areas.slug")).toBe(
      true,
    );
    expect(
      database.isUniqueViolation(alone, "threads.user_id, threads.slug"),
    ).toBe(false);

    const batched = await db
      .batch([db.update(areas).set({ name: "Changed" }), duplicate()])
      .catch((error: unknown) => error);
    expect(
      database.isUniqueViolation(batched, "areas.user_id, areas.slug"),
    ).toBe(true);
    // The batch rolled back the statement before the one that failed.
    expect((await db.select().from(areas))[0]!.name).toBe("Home");

    const outage = new Error("SQLITE_BUSY: database is locked");
    expect(
      database.isUniqueViolation(outage, "areas.user_id, areas.slug"),
    ).toBe(false);
  });

  it("enforces foreign keys on its connection", async () => {
    const { database } = await seededDatabase();
    expect(await database.drizzle.all(sql`PRAGMA foreign_keys`)).toEqual([
      { foreign_keys: 1 },
    ]);
    await expect(
      database.drizzle.insert(threadNotes).values({
        id: "orphan",
        user_id: LOCAL_OWNER_ID,
        thread_id: "no-such-thread",
        body: "Orphan",
        state: "open",
        created_at: 1,
        updated_at: 1,
      }),
    ).rejects.toThrow();
  });
});

describe("opening a local database", () => {
  it("migrates once, keeps data across reopening, and closes", async () => {
    const databaseDirectory = await mkdtemp(join(directory, "reopen-"));
    const options = {
      databasePath: join(databaseDirectory, "vita.db"),
      migrationsDirectory: MIGRATIONS,
    };
    const first = await openLocalDatabase(options);
    expect(first.migration.applied.length).toBeGreaterThan(0);
    await value(
      createLocalApplicationClient({ db: first.database }).createNote({
        body: "Keep me",
      }),
    );
    first.close();

    const second = await openLocalDatabase(options);
    opened.push(second);
    expect(second.migration).toEqual({ applied: [], backupPath: null });
    await expect(
      createLocalApplicationClient({ db: second.database }).listOpenNotes(),
    ).resolves.toMatchObject({ ok: true, value: [{ body: "Keep me" }] });
  });
});
