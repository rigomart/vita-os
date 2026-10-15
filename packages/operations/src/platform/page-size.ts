import type { ApplicationError } from "@vita-os/contracts";

import { Result } from "better-result";

import { InvalidInput } from "./failures";
import { invalidPagination } from "./sqlite/page-cursor";

/**
 * How large a page may be, per history.
 *
 * A caller that names no size gets the fallback; one that asks for more than the
 * maximum is refused rather than quietly served less, so an unbounded read cannot
 * be requested by accident.
 */
export type PageSize = { fallback: number; maximum: number };

export function isPageLimit(limit: number, size: PageSize): boolean {
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= size.maximum;
}

/** Refuses a page limit its history doesn't allow, in that history's words. */
export function requirePageLimit(
  limit: number,
  size: PageSize,
  refusal: ApplicationError = invalidPagination,
): Result<void, InvalidInput> {
  return isPageLimit(limit, size)
    ? Result.ok(undefined)
    : Result.err(new InvalidInput({ message: refusal.message }));
}
