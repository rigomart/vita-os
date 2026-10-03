import { useRouterState } from "@tanstack/react-router";

import { readProductSearch, type ProductSearch } from "./search-params";

export type DashboardFilterParams = Pick<ProductSearch, "area" | "show">;

/**
 * The Dashboard's filter, `?area=` or `?show=`, as the URL carries it.
 *
 * Read from the router's location rather than a route match, so a screen reads
 * it the same way wherever it is mounted.
 */
export function useDashboardFilterParams(): DashboardFilterParams {
  const area = useRouterState({
    select: (state) =>
      readProductSearch(state.location.search as Record<string, unknown>).area,
  });
  const show = useRouterState({
    select: (state) =>
      readProductSearch(state.location.search as Record<string, unknown>).show,
  });
  return { area, show };
}
