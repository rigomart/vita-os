/**
 * What the error dialog says when the data can't be opened or migrated, or the
 * window can't load. `knownBackupPath` is the copy a migration that did succeed
 * took, so a later failure still says where the data from before it is.
 */
export function startupFailure(
  error: unknown,
  knownBackupPath: string | null = null,
): { title: string; content: string } {
  const message = error instanceof Error ? error.message : String(error);
  const backupPath =
    error instanceof Error &&
    "backupPath" in error &&
    typeof error.backupPath === "string"
      ? error.backupPath
      : knownBackupPath;
  return {
    title: "Vita OS couldn't start",
    content:
      backupPath === null
        ? message
        : `${message}\n\nA copy of your data from before this update is at:\n${backupPath}`,
  };
}
