import { Result } from "better-result";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";
import type { ExportFile } from "../../platform/sqlite/export-file";

import { database } from "../../platform/operation";
import { EXPORT_FORMAT } from "../../platform/sqlite/export-file";
import { exportStorage } from "./storage";

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
