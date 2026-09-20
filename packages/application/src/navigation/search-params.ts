/**
 * The search parameters the product's own surfaces read and write.
 *
 * `?thread=<slug>` summons a Thread in place over whatever page is showing, and
 * `?inbox=true` summons the Notes panel the same way. The shared application
 * defines them because they belong to the product's behavior; a host mounts the
 * routes that validate them.
 */
export interface ProductSearch {
  thread?: string | undefined;
  inbox?: true | undefined;
}

/** What a host's route should make of an unvalidated search object. */
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
