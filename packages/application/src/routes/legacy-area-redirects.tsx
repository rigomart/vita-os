import { Navigate, useParams } from "@tanstack/react-router";

import type { ProductSearch } from "../navigation/search-params";

/**
 * Areas used to have pages, and Thread links used to carry their Area. Both
 * addresses survive as redirects so bookmarks and history keep working.
 */

/** `/$areaSlug` lands on the Dashboard filtered by that Area. */
export function LegacyAreaRedirect() {
  const { areaSlug } = useParams({ from: "/_authenticated/$areaSlug" });

  return (
    <Navigate
      to="/"
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        area: areaSlug,
      })}
      replace
    />
  );
}

/** `/$areaSlug/$threadSlug` lands on the Thread's own address. */
export function LegacyAreaThreadRedirect() {
  const { threadSlug } = useParams({
    from: "/_authenticated/$areaSlug/$threadSlug",
  });

  return (
    <Navigate
      to="/threads/$threadSlug"
      params={{ threadSlug }}
      search={(previous: ProductSearch): ProductSearch => previous}
      replace
    />
  );
}
