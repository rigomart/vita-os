import type { OperationResult } from "@vita-os/contracts";

import { ExportFileSchema } from "@vita-os/operations";
import {
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LocalDatabase } from "./open.ts";

import { createLocalApplicationClient, exportLocalData } from "./client.ts";
import { DamagedDatabaseError } from "./integrity.ts";
import { openLocalDatabase } from "./open.ts";

const MIGRATIONS = fileURLToPath(
  new URL("../../../apps/api/migrations", import.meta.url),
);

let directory: string;
let opened: LocalDatabase[];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "vita local open "));
  opened = [];
});

afterEach(async () => {
  for (const local of opened) local.close();
  await rm(directory, { recursive: true, force: true });
});

async function openAt(databasePath: string): Promise<LocalDatabase> {
  const local = await openLocalDatabase({
    databasePath,
    migrationsDirectory: MIGRATIONS,
  });
  opened.push(local);
  return local;
}

async function value<T>(operation: Promise<OperationResult<T>>): Promise<T> {
  const result = await operation;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

async function withNote(databasePath: string, body: string) {
  const local = await openAt(databasePath);
  const client = createLocalApplicationClient({ db: local.database });
  await value(client.createNote({ body }));
  return { local, client };
}

describe("a backup", () => {
  it("opens as the same data, and is written whole or not at all", async () => {
    const { local, client } = await withNote(
      join(directory, "vita.db"),
      "Renew passport",
    );
    const backup = join(directory, "backup.db");
    await local.backUpTo(backup);
    await expect(local.backUpTo(backup)).rejects.toThrow("already exists");
    await expect(
      local.backUpTo(join(directory, "missing", "b.db")),
    ).rejects.toThrow();
    expect((await readdir(directory)).sort()).toEqual(["backup.db", "vita.db"]);

    const restored = createLocalApplicationClient({
      db: (await openAt(backup)).database,
    });
    expect(await value(restored.listOpenNotes())).toEqual(
      await value(client.listOpenNotes()),
    );
  });
});

describe("a damaged file", () => {
  it("is refused before anything writes to it, when it isn't a database", async () => {
    const databasePath = join(directory, "vita.db");
    await writeFile(databasePath, "not a database, just text ".repeat(200));
    const before = await readFile(databasePath);

    await expect(openAt(databasePath)).rejects.toBeInstanceOf(
      DamagedDatabaseError,
    );
    expect(await readFile(databasePath)).toEqual(before);
    expect(await readdir(directory)).toEqual(["vita.db"]);
  });

  it("is refused when its pages don't hold together", async () => {
    const databasePath = join(directory, "vita.db");
    const { local } = await withNote(databasePath, "Call the vet");
    local.close();
    opened = opened.filter((open) => open !== local);
    // Scribble over every page's header but the first, which SQLite reads to open the file.
    const handle = await open(databasePath, "r+");
    const { size } = await handle.stat();
    for (let page = 4096; page < size; page += 4096) {
      await handle.write(Buffer.alloc(12, 0xab), 0, 12, page);
    }
    await handle.close();
    const before = await readFile(databasePath);

    const refused = await openAt(databasePath).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(DamagedDatabaseError);
    expect((refused as Error).message).toContain(`${databasePath} is damaged:`);
    expect(await readFile(databasePath)).toEqual(before);
  });
});

describe("Download my data on desktop", () => {
  it("saves what the web's export saves: the stored rows, as the export schema decodes them", async () => {
    const { local } = await withNote(
      join(directory, "vita.db"),
      "Water plants",
    );
    const file = v.parse(
      ExportFileSchema,
      JSON.parse(JSON.stringify(await exportLocalData({ db: local.database }))),
    );
    expect(file.notes.map((note) => note.body)).toEqual(["Water plants"]);
    expect(file.migration).toMatch(/\.sql$/);
  });
});
