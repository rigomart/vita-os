/**
 * The search parameters the product's own surfaces read and write.
 *
 * `?thread=<slug>` summons a Thread in place over whatever page is showing,
 * `?inbox=true` summons the Notes panel the same way, and `?area=<slug>` (or
 * `?area=none`) filters the Dashboard. The shared application defines them and
 * validates them in its own route tree.
 */
export interface ProductSearch {
  thread?: string | undefined;
  inbox?: true | undefined;
  area?: string | undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Validate the product's URL search parameters. */
export function readProductSearch(
  search: Record<string, unknown>,
): ProductSearch {
  return {
    thread: nonEmptyString(search.thread),
    inbox: search.inbox === true || search.inbox === "true" ? true : undefined,
    area: nonEmptyString(search.area),
  };
}
