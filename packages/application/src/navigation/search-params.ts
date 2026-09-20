/**
 * The search parameters the product's own surfaces read and write.
 *
 * `?thread=<slug>` summons a Thread in place over whatever page is showing, and
 * `?inbox=true` summons the Notes panel the same way. The shared application
 * defines them and validates them in its own route tree.
 */
export interface ProductSearch {
  thread?: string | undefined;
  inbox?: true | undefined;
}

/** Validate the product's URL search parameters. */
export function readProductSearch(
  search: Record<string, unknown>,
): ProductSearch {
  return {
    thread:
      typeof search.thread === "string" && search.thread.length > 0
        ? search.thread
        : undefined,
    inbox: search.inbox === true || search.inbox === "true" ? true : undefined,
  };
}
