import type { Database } from "@vita-os/operations";

import { rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

import type { MigrationOptions, MigrationResult } from "./migrations.ts";

import { openConnection } from "./connection.ts";
import { libsqlDatabase } from "./database.ts";
import { exists, flush } from "./files.ts";
import { checkIntegrity } from "./integrity.ts";
import { migrateDatabase } from "./migrations.ts";

export interface LocalDatabase {
  database: Database;
  migration: MigrationResult;
  /**
   * Writes a consistent copy of the data to `path`, whole or not at all: it
   * is written beside `path` and renamed into place once on disk.
   */
  backUpTo(path: string): Promise<void>;
  close(): void;
}

/** Checks and migrates first, so a damaged file or a refused or failed migration opens nothing. */
export async function openLocalDatabase(
  options: MigrationOptions,
): Promise<LocalDatabase> {
  await checkIntegrity(options.databasePath);
  const migration = await migrateDatabase(options);
  const client = await openConnection(options.databasePath);
  return {
    database: libsqlDatabase(client),
    migration,
    async backUpTo(path) {
      if (await exists(path)) throw new Error(`${path} already exists.`);
      const partial = `${path}.partial`;
      try {
        await rm(partial, { force: true });
        await client.execute({ sql: "VACUUM INTO ?", args: [partial] });
        await flush(partial);
        await rename(partial, path);
        await flush(dirname(path));
      } catch (error) {
        await rm(partial, { force: true });
        throw error;
      }
    },
    close: () => client.close(),
  };
}
