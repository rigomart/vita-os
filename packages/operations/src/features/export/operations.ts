import { Result } from "better-result";
import * as v from "valibot";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";
import type { ExportFile } from "../../platform/sqlite/export-file";

import { InvalidInput, RefusedByState } from "../../platform/failures";
import { database } from "../../platform/operation";
import {
  EXPORT_FORMAT,
  ExportFileSchema,
} from "../../platform/sqlite/export-file";
import { exportStorage, importStorage } from "./storage";

/**
 * All of the owner's data as stored, for them to keep or import elsewhere.
 * The whole file is built in memory, which is fine at one person's scale.
 */
export function exportData(scope: RequestScope): Operation<ExportFile> {
  return Result.gen(async function* () {
    const rows = yield* Result.await(
      database(() => exportStorage(scope).read()),
    );
    const file: ExportFile = {
      format: EXPORT_FORMAT,
      exportedAt: scope.clock.now(),
      ...rows,
    };
    return Result.ok(file);
  });
}

export interface ImportedCounts {
  areas: number;
  threads: number;
  notes: number;
}

/**
 * An export, as {@link exportData} wrote it, into a database with nothing in
 * it: every row as stored, owned by the actor. A file that doesn't decode, one
 * from another migration, or a database that already holds a record is
 * refused with nothing written.
 *
 * The emptiness check and the write are two round trips, so a record created
 * between them would be imported beside.
 */
export function importData(
  scope: RequestScope,
  file: unknown,
): Operation<ImportedCounts> {
  return Result.gen(async function* () {
    const decoded = v.safeParse(ExportFileSchema, file);
    if (!decoded.success) {
      const [issue] = decoded.issues;
      const at = v.getDotPath(issue);
      return Result.err(
        new InvalidInput({
          message: `This file isn't a Vita OS export: ${at ? `${at}: ` : ""}${issue.message}`,
        }),
      );
    }
    const {
      format: _format,
      exportedAt: _exportedAt,
      ...rows
    } = decoded.output;
    const storage = importStorage(scope);
    const target = yield* Result.await(database(() => storage.readTarget()));
    if (rows.migration !== target.migration) {
      return Result.err(
        new RefusedByState({
          message: versionMismatch(rows.migration, target.migration),
        }),
      );
    }
    if (target.hasRecords) {
      return Result.err(
        new RefusedByState({
          message:
            "Vita OS already has data on this computer. Import goes only into an empty Vita OS, so nothing was imported.",
        }),
      );
    }
    yield* Result.await(database(() => storage.write(rows)));
    return Result.ok({
      areas: rows.areas.length,
      threads: rows.threads.length,
      notes: rows.notes.length,
    });
  });
}

function versionMismatch(file: string, here: string | null): string {
  const versions = `The file is at version ${file}, and this Vita OS is at ${here ?? "no version"}.`;
  const fix =
    here !== null && migrationNumber(file) < migrationNumber(here)
      ? "Download a fresh export from the web app and import that."
      : "Update this Vita OS, then import the file again.";
  return `${versions} ${fix}`;
}

const migrationNumber = (name: string) => Number.parseInt(name, 10);
