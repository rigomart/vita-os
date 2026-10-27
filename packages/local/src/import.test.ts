import type { OperationResult, TaskId, ThreadNoteId } from "@vita-os/contracts";
import type { ExportFile } from "@vita-os/operations";

import {
  activityLogEntries,
  areas,
  notes,
  threadNotes,
  threads,
} from "@vita-os/operations/internal/platform/sqlite/schema";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LocalDatabase } from "./open.ts";

import {
  createLocalApplicationClient,
  exportLocalData,
  importLocalData,
  LOCAL_OWNER_ID,
} from "./client.ts";
import { openLocalDatabase } from "./open.ts";

const MIGRATIONS = fileURLToPath(
  new URL("../../../apps/api/migrations", import.meta.url),
);

let directory: string;
const opened: LocalDatabase[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "vita local import "));
});

afterAll(async () => {
  for (const local of opened) local.close();
  await rm(directory, { recursive: true, force: true });
});

async function freshDatabase(): Promise<LocalDatabase> {
  const local = await openLocalDatabase({
    databasePath: join(await mkdtemp(join(directory, "db-")), "vita.db"),
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

/** An export holding every record kind. */
async function exportedFile(): Promise<ExportFile> {
  const { database } = await freshDatabase();
  const client = createLocalApplicationClient({ db: database });
  const area = await value(client.createArea({ name: "Home", icon: "Home" }));
  const thread = await value(
    client.createThread({ title: "Fix the tap", areaId: area._id }),
  );
  await value(
    client.addTask({
      threadId: thread._id,
      taskId: "a" as TaskId,
      text: "Buy a cartridge",
      date: Date.UTC(2026, 9, 20),
    }),
  );
  await value(
    client.addTask({
      threadId: thread._id,
      taskId: "b" as TaskId,
      text: "Fit it",
    }),
  );
  await value(
    client.completeTask({
      threadId: thread._id,
      taskId: "a" as TaskId,
      expectedOccurrence: Date.UTC(2026, 9, 20),
      note: { id: crypto.randomUUID() as ThreadNoteId, body: "Bought" },
    }),
  );
  await value(
    client.createThreadNote({ threadId: thread._id, body: "Ask a plumber" }),
  );
  const resolved = await value(client.createThread({ title: "Old roof" }));
  await value(
    client.updateThread({ threadId: resolved._id, state: "resolved" }),
  );
  await value(
    client.createNote({ body: "Call mum", followUp: Date.UTC(2026, 9, 21) }),
  );
  const done = await value(client.createNote({ body: "Pay rent" }));
  await value(client.markNoteDone({ noteId: done._id }));
  return JSON.parse(
    JSON.stringify(await exportLocalData({ db: database })),
  ) as ExportFile;
}

async function stored(local: LocalDatabase) {
  const database = local.database.drizzle;
  return {
    areas: await database.select().from(areas),
    threads: await database.select().from(threads),
    activity_log_entries: await database.select().from(activityLogEntries),
    notes: await database.select().from(notes),
    thread_notes: await database.select().from(threadNotes),
  };
}

const empty = {
  areas: [],
  threads: [],
  activity_log_entries: [],
  notes: [],
  thread_notes: [],
};

const withoutTime = ({ exportedAt: _, ...rest }: ExportFile) => rest;

describe("importing a cloud export", () => {
  it("stores every record as the export holds it, owned by the local owner", async () => {
    const file = await exportedFile();
    expect(file.threads.map((thread) => thread.state).sort()).toEqual([
      "open",
      "resolved",
    ]);
    expect(file.activity_log_entries.length).toBeGreaterThan(0);
    expect(file.notes.map((note) => note.state).sort()).toEqual([
      "done",
      "open",
    ]);
    expect(file.thread_notes.map((note) => note.body).sort()).toEqual([
      "Ask a plumber",
      "Bought",
    ]);

    const local = await freshDatabase();
    await expect(
      importLocalData({ db: local.database }, JSON.stringify(file)),
    ).resolves.toEqual({ areas: 1, threads: 2, notes: 2 });

    expect(
      withoutTime(await exportLocalData({ db: local.database })),
    ).toStrictEqual(withoutTime(file));
    const owners = Object.values(await stored(local))
      .flat()
      .map((row) => row.user_id);
    expect(new Set(owners)).toEqual(new Set([LOCAL_OWNER_ID]));

    const client = createLocalApplicationClient({ db: local.database });
    const [open] = await value(client.listOpenThreads());
    const detail = await value(client.getThreadDetail({ slug: open!.slug }));
    expect(detail.thread.tasks?.map((task) => task.text)).toContain("Fit it");
    expect(detail.area?.name).toBe("Home");
  });

  it("writes more rows than one insert holds", async () => {
    const file = await exportedFile();
    const [note] = file.notes;
    const many = {
      ...file,
      notes: Array.from({ length: 250 }, (_, index) => ({
        ...note!,
        id: `note-${index}`,
      })),
    };

    const local = await freshDatabase();
    await importLocalData({ db: local.database }, JSON.stringify(many));
    expect((await stored(local)).notes).toHaveLength(250);
  });

  it.each([
    [
      "isn't JSON",
      "{ not json",
      "This file isn't a Vita OS export: it isn't JSON.",
    ],
    [
      "is some other JSON",
      JSON.stringify({ hello: "world" }),
      "This file isn't a Vita OS export:",
    ],
  ])("refuses a file that %s, changing nothing", async (_, text, message) => {
    const local = await freshDatabase();
    await expect(importLocalData({ db: local.database }, text)).rejects.toThrow(
      message,
    );
    expect(await stored(local)).toEqual(empty);
  });

  it("refuses a row its column couldn't hold, and says where", async () => {
    const file = await exportedFile();
    file.threads[0]!.revision = 2 ** 53;

    const local = await freshDatabase();
    await expect(
      importLocalData({ db: local.database }, JSON.stringify(file)),
    ).rejects.toThrow("This file isn't a Vita OS export: threads.0.revision:");
    expect(await stored(local)).toEqual(empty);
  });

  it("refuses a file from another version, naming both", async () => {
    const file = await exportedFile();
    const local = await freshDatabase();

    await expect(
      importLocalData(
        { db: local.database },
        JSON.stringify({ ...file, migration: "0001_auth.sql" }),
      ),
    ).rejects.toThrow(
      `The file is at version 0001_auth.sql, and this Vita OS is at ${file.migration}. Download a fresh export from the web app and import that.`,
    );
    await expect(
      importLocalData(
        { db: local.database },
        JSON.stringify({ ...file, migration: "9999_later.sql" }),
      ),
    ).rejects.toThrow(
      `The file is at version 9999_later.sql, and this Vita OS is at ${file.migration}. Update this Vita OS, then import the file again.`,
    );
    expect(await stored(local)).toEqual(empty);
  });

  it("refuses a database that already holds a record, changing nothing", async () => {
    const file = await exportedFile();
    const local = await freshDatabase();
    const client = createLocalApplicationClient({ db: local.database });
    await value(client.createNote({ body: "Already here" }));
    const before = await stored(local);

    await expect(
      importLocalData({ db: local.database }, JSON.stringify(file)),
    ).rejects.toThrow("Vita OS already has data on this computer.");
    expect(await stored(local)).toEqual(before);
  });

  it("refuses a second import of the same file", async () => {
    const file = JSON.stringify(await exportedFile());
    const local = await freshDatabase();
    await importLocalData({ db: local.database }, file);
    const before = await stored(local);

    await expect(importLocalData({ db: local.database }, file)).rejects.toThrow(
      "Vita OS already has data on this computer.",
    );
    expect(await stored(local)).toEqual(before);
  });

  it("leaves the database empty when a write fails part way", async () => {
    const file = await exportedFile();
    file.thread_notes.push({
      ...file.thread_notes[0]!,
      id: "orphan",
      thread_id: "missing-thread",
    });

    const local = await freshDatabase();
    const refused = (await importLocalData(
      { db: local.database },
      JSON.stringify(file),
    ).then(
      () => undefined,
      (error: unknown) => error,
    )) as Error;
    expect(refused).toBeInstanceOf(Error);
    expect(refused.message).toBe("Vita OS couldn't write the imported data.");
    expect(String(refused.cause)).toContain("FOREIGN KEY constraint failed");
    expect(await stored(local)).toEqual(empty);
  });
});
