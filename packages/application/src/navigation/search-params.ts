/**
 * The search parameters the product's own surfaces read and write.
 *
 * `?thread=<slug>` summons a Thread in place over whatever page is showing.
 * The Dashboard's filter is one of two parameters, never both: `?area=<slug>`
 * (or `?area=none`) narrows it to Threads, and `?show=notes` to Standalone
 * Notes. Notes get a parameter of their own so no Area slug can ever collide
 * with them. `?inbox=true` is the old address of the Notes panel; it is read
 * only to redirect to the Notes filter. The shared application defines them
 * and validates them in its own route tree.
 */
export interface ProductSearch {
  thread?: string | undefined;
  area?: string | undefined;
  show?: DashboardShow | undefined;
  /** Legacy: redirects to `?show=notes`. */
  inbox?: true | undefined;
}

/** The `?show=` value that filters the Dashboard to Standalone Notes. */
export const NOTES_FILTER = "notes";

export type DashboardShow = typeof NOTES_FILTER;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Validate the product's URL search parameters. */
export function readProductSearch(
  search: Record<string, unknown>,
): ProductSearch {
  return {
    thread: nonEmptyString(search.thread),
    area: nonEmptyString(search.area),
    // An unknown value is no filter at all, so the board falls back to All.
    show: search.show === NOTES_FILTER ? NOTES_FILTER : undefined,
    inbox: search.inbox === true || search.inbox === "true" ? true : undefined,
  };
}

/**
 * Where choosing a Dashboard filter leaves the URL: the one parameter it
 * names is set and the other cleared, so the two never coexist.
 */
export function withDashboardFilter(filter: {
  area?: string | undefined;
  show?: DashboardShow | undefined;
}) {
  return (previous: ProductSearch): ProductSearch => ({
    ...previous,
    area: filter.area,
    show: filter.show,
  });
}

/** The Dashboard with only the Notes filter; the rest of the URL is kept. */
export function toNotesFilter(previous: ProductSearch): ProductSearch {
  return {
    ...withDashboardFilter({ show: NOTES_FILTER })(previous),
    inbox: undefined,
  };
}
