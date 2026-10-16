import { access, open } from "node:fs/promises";

export async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

/** `VACUUM INTO` writes a consistent snapshot but doesn't fsync it, so this does. */
export async function flush(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
