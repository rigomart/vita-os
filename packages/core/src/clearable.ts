import { platformCrypto } from "./platform-crypto";

/**
 * Turns every cleared value in a patch into an absent one, keeping the key.
 *
 * A transport cannot carry "absent with intent": JSON has no `undefined`, so a
 * caller asking for a value to be removed sends `null`. Storage, on the other
 * hand, distinguishes a key that is present-but-empty (remove this) from a key
 * that never arrived (leave it alone). This is the one translation between them.
 */
export function clearedToAbsent<T extends Record<string, unknown>>(
  patch: T,
): { [K in keyof T]: Exclude<T[K], null> } {
  const result = { ...patch } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (result[key] === null) result[key] = undefined;
  }
  return result as { [K in keyof T]: Exclude<T[K], null> };
}

/** A collision-resistant opaque record ID for a newly created record. */
export function newRecordId(): string {
  return platformCrypto().randomUUID();
}
