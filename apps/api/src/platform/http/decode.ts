/** A bounded page size; query conversion retains the existing Number semantics. */
export type PageSize = { fallback: number; maximum: number };

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
