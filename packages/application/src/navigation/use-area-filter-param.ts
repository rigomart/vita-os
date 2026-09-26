import { useRouterState } from "@tanstack/react-router";

import { readProductSearch } from "./search-params";

/**
 * The Dashboard's `?area=` filter, as the URL carries it.
 *
 * Read from the router's location rather than a route match, so a screen reads
 * it the same way wherever it is mounted.
 */
export function useAreaFilterParam(): string | undefined {
  return useRouterState({
    select: (state) =>
      readProductSearch(state.location.search as Record<string, unknown>).area,
  });
}
