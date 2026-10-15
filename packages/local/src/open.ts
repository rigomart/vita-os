import type { Database } from "@vita-os/operations";

import type { MigrationOptions, MigrationResult } from "./migrations.ts";

import { openConnection } from "./connection.ts";
import { libsqlDatabase } from "./database.ts";
import { migrateDatabase } from "./migrations.ts";

export interface LocalDatabase {
  database: Database;
  migration: MigrationResult;
  close(): void;
}

/** Migrates first, so a refused or failed migration opens nothing. */
export async function openLocalDatabase(
  options: MigrationOptions,
): Promise<LocalDatabase> {
  const migration = await migrateDatabase(options);
  const client = await openConnection(options.databasePath);
  return {
    database: libsqlDatabase(client),
    migration,
    close: () => client.close(),
  };
}
