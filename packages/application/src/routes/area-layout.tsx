import { Outlet, useParams } from "@tanstack/react-router";

import { AreaDetailScreen } from "../areas/area-detail/area-detail-screen";

/** Reads its params by route ID so screens never import the route tree back. */
export function AreaLayout() {
  const { areaSlug } = useParams({ from: "/_authenticated/$areaSlug" });

  return (
    <>
      <AreaDetailScreen areaSlug={areaSlug} />
      <Outlet />
    </>
  );
}
