/**
 * Converts all `null` values in an object to `undefined`.
 *
 * Convex strips `undefined` from function args (so clients can't send it),
 * but `db.patch` treats `undefined` as "remove field". This bridges the gap:
 * clients send `null` to mean "clear", and we convert before patching.
 */
export function nullsToUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], null> } {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if ((result as Record<string, unknown>)[key] === null) {
      (result as Record<string, unknown>)[key] = undefined;
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], null> };
}
