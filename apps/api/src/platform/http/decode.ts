/**
 * How large a page may be, per history.
 *
 * A caller that names no size gets the fallback; one that asks for more than the
 * maximum is refused rather than quietly served less, so an unbounded read cannot
 * be requested by accident.
 */
export type PageSize = { fallback: number; maximum: number };

/** A bounded page size; query conversion retains the existing Number semantics. */
export function decodeLimit(
  value: string | undefined,
  size: PageSize,
): number | undefined {
  if (value === undefined) return size.fallback;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= size.maximum
    ? limit
    : undefined;
}
