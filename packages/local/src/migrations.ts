import type { Client } from "@libsql/client";

import { readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { openConnection } from "./connection.ts";
import { exists, flush } from "./files.ts";

/*
 * Applies `apps/api/migrations` to a local file the way
 * `wrangler d1 migrations apply` applies them to D1, so both share one history.
 */

export type MigrationOptions = {
  databasePath: string;
  migrationsDirectory: string;
};

export type MigrationResult = {
  applied: string[];
  /** Null when nothing was pending or the file was empty. */
  backupPath: string | null;
};

export class UnknownMigrationsError extends Error {
  override readonly name = "UnknownMigrationsError";
  constructor(
    readonly databasePath: string,
    readonly unknownMigrations: readonly string[],
  ) {
    super(
      `${databasePath} has migrations this app doesn't know: ${unknownMigrations.join(", ")}. It was written by a newer version. Nothing was changed.`,
    );
  }
}

export class UnrecognizedDatabaseError extends Error {
  override readonly name = "UnrecognizedDatabaseError";
  constructor(readonly databasePath: string) {
    super(
      `${databasePath} has tables but no d1_migrations history, so it isn't a Vita OS database. Nothing was changed.`,
    );
  }
}

/** Migrations before the failed one stay applied, as with Wrangler. */
export class MigrationFailedError extends Error {
  override readonly name = "MigrationFailedError";
  constructor(
    readonly migration: string,
    readonly applied: readonly string[],
    readonly backupPath: string | null,
    options: { cause: unknown },
  ) {
    super(
      `Migration ${migration} failed and was rolled back${backupPath === null ? "" : `; the database before this run is at ${backupPath}`}: ${messageOf(options.cause)}`,
      options,
    );
  }
}

const MIGRATIONS_TABLE = "d1_migrations";

/** Wrangler's own definition. */
const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);`;

export async function migrateDatabase(
  options: MigrationOptions,
): Promise<MigrationResult> {
  const { databasePath } = options;
  const migrations = await listMigrations(options.migrationsDirectory);
  const client = await openConnection(databasePath);
  try {
    const hasSchema = await hasAnySchema(client);
    const applied = await readAppliedMigrations(client);
    if (applied === null && hasSchema) {
      throw new UnrecognizedDatabaseError(databasePath);
    }
    const known = new Set(migrations);
    const unknown = (applied ?? []).filter((name) => !known.has(name));
    if (unknown.length > 0) {
      throw new UnknownMigrationsError(databasePath, unknown);
    }

    const done = new Set(applied);
    const pending = migrations.filter((name) => !done.has(name));
    if (pending.length === 0) return { applied: [], backupPath: null };

    const backupPath = hasSchema
      ? await copyBeforeMigrating(client, databasePath, pending[0]!)
      : null;

    const appliedNow: string[] = [];
    for (const name of pending) {
      const sql = await readFile(
        join(options.migrationsDirectory, name),
        "utf8",
      );
      try {
        await applyMigration(client, name, sql);
      } catch (cause) {
        throw new MigrationFailedError(name, appliedNow, backupPath, { cause });
      }
      appliedNow.push(name);
    }
    return { applied: appliedNow, backupPath };
  } finally {
    client.close();
  }
}

/** Wrangler's order: by leading number, then by name. */
async function listMigrations(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".sql") &&
        !entry.name.startsWith("."),
    )
    .map((entry) => entry.name)
    .sort(compareMigrationNames);
}

function compareMigrationNames(a: string, b: string): number {
  const aNumber = leadingNumber(a);
  const bNumber = leadingNumber(b);
  if (aNumber !== bNumber) {
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }
    if (Number.isFinite(aNumber)) return -1;
    if (Number.isFinite(bNumber)) return 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function leadingNumber(name: string): number {
  return Number.parseInt(name.split("_")[0]!, 10);
}

async function hasAnySchema(client: Client): Promise<boolean> {
  const result = await client.execute(
    "SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1",
  );
  return result.rows.length > 0;
}

/** Applied migration names, or null when the file has no history table. */
async function readAppliedMigrations(client: Client): Promise<string[] | null> {
  const table = await client.execute({
    sql: "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
    args: [MIGRATIONS_TABLE],
  });
  if (table.rows.length === 0) return null;
  const rows = await client.execute(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`,
  );
  return rows.rows.map((row) => String(row.name));
}

async function copyBeforeMigrating(
  client: Client,
  databasePath: string,
  firstPending: string,
): Promise<string> {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const backupPath = `${databasePath}.before-${firstPending.replace(/\.sql$/, "")}-${stamp}`;
  if (await exists(backupPath)) {
    throw new Error(`${backupPath} already exists. Nothing was changed.`);
  }
  try {
    await client.execute({ sql: "VACUUM INTO ?", args: [backupPath] });
    await flush(backupPath);
    await flush(dirname(backupPath));
  } catch (error) {
    await rm(backupPath, { force: true });
    throw error;
  }
  return backupPath;
}

/** The file and its history row commit together, as on D1. */
async function applyMigration(
  client: Client,
  name: string,
  sql: string,
): Promise<void> {
  const transaction = await client.transaction("write");
  try {
    await transaction.execute(CREATE_MIGRATIONS_TABLE);
    await transaction.executeMultiple(sql);
    await transaction.execute({
      sql: `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
      args: [name],
    });
    await transaction.commit();
  } finally {
    // Rolls back unless the commit went through.
    transaction.close();
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
