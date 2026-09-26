/**
 * The pieces every request decoder is built from.
 *
 * A request body is untrusted text until a decoder has read it. Each decoder
 * returns `undefined` for anything it does not recognize, so a handler cannot
 * accidentally act on a half-understood body. Clearing an optional value is
 * spelled `null`, which is the only thing JSON can carry for it.
 */

export type Decoded<T> = T | undefined;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isClearableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function isClearableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

/** A revision counts changes, so any nonnegative whole number will do. */
export function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Only the keys a decoder understands may appear. */
export function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * How large a page may be, per history.
 *
 * A caller that names no size gets the fallback; one that asks for more than the
 * maximum is refused rather than quietly served less, so an unbounded read cannot
 * be requested by accident.
 */
export type PageSize = { fallback: number; maximum: number };

/** A bounded page size. An unreadable value is refused, not replaced. */
export function decodeLimit(
  value: string | undefined,
  size: PageSize,
): Decoded<number> {
  if (value === undefined) return size.fallback;

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > size.maximum) {
    return undefined;
  }

  return limit;
}
