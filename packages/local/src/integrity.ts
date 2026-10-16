import { createClient } from "@libsql/client";
import { pathToFileURL } from "node:url";

import { exists } from "./files.ts";

export class DamagedDatabaseError extends Error {
  override readonly name = "DamagedDatabaseError";
  constructor(
    readonly databasePath: string,
    readonly problems: readonly string[],
  ) {
    super(
      `${databasePath} is damaged: ${problems.slice(0, 3).join("; ")}. Nothing was changed.`,
    );
  }
}

/**
 * Refuses a file SQLite reports as damaged, before anything writes to it.
 * `quick_check` reads every page but skips the slower index cross-checks,
 * which is quick at one person's scale. A file that doesn't exist yet is new.
 */
export async function checkIntegrity(databasePath: string): Promise<void> {
  if (!(await exists(databasePath))) return;
  const client = createClient({
    url: pathToFileURL(databasePath).href,
    concurrency: 1,
  });
  try {
    const result = await client.execute("PRAGMA quick_check");
    const problems = result.rows.map((row) => String(row[0]));
    if (problems.length !== 1 || problems[0] !== "ok") {
      throw new DamagedDatabaseError(databasePath, problems);
    }
  } catch (error) {
    if (isDamage(error)) {
      throw new DamagedDatabaseError(databasePath, [(error as Error).message]);
    }
    throw error;
  } finally {
    client.close();
  }
}

/** Not a database at all, or one whose pages don't hold together. */
function isDamage(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  return code.startsWith("SQLITE_NOTADB") || code.startsWith("SQLITE_CORRUPT");
}
