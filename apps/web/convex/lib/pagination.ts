import type { PaginationResult } from "convex/server";

/**
 * The page a paginated query returns when the caller may see nothing —
 * unauthenticated, or asking about a document that is not theirs.
 *
 * It mirrors what non-paginated queries do with `[]`: an empty result rather
 * than an error, so a foreign id is indistinguishable from an absent one.
 * `isDone` is true because there is nothing further to page through.
 */
export function emptyPage<T>(): PaginationResult<T> {
  return { page: [], isDone: true, continueCursor: "" };
}
