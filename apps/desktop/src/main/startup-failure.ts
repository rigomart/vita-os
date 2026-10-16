import { DamagedDatabaseError } from "@vita-os/local";

export interface StartupFailureContext {
  /** The copy a migration that did succeed took, so a later failure still says where the data from before it is. */
  migrationBackup?: string | null;
  /** The newest daily backup, named when the data file itself is damaged. */
  newestBackup?: string | undefined;
}

/**
 * What the error dialog says when the data can't be opened or migrated, or the
 * window can't load.
 */
export function startupFailure(
  error: unknown,
  { migrationBackup = null, newestBackup }: StartupFailureContext = {},
): { title: string; content: string } {
  const message = error instanceof Error ? error.message : String(error);
  const title = "Vita OS couldn't start";
  if (error instanceof DamagedDatabaseError) {
    return {
      title,
      content:
        newestBackup === undefined
          ? `${message}\n\nThere is no backup of it yet.`
          : `${message}\n\nThe newest backup is at:\n${newestBackup}\n\nTo go back to it, replace vita.db with a copy of that file, named vita.db, and open Vita OS again.`,
    };
  }
  const backupPath =
    error instanceof Error &&
    "backupPath" in error &&
    typeof error.backupPath === "string"
      ? error.backupPath
      : migrationBackup;
  return {
    title,
    content:
      backupPath === null
        ? message
        : `${message}\n\nA copy of your data from before this update is at:\n${backupPath}`,
  };
}
