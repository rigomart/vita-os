import { Navigate } from "@tanstack/react-router";

import { toNotesFilter } from "../navigation/search-params";

/**
 * Notes have no page or panel of their own: they are on the Dashboard. The
 * old addresses of the Notes panel, `/notes` and `/inbox`, land on the
 * Dashboard filtered to Notes, carrying any other search param (an open
 * Thread, say) across.
 */
export function NotesDeepLinkRedirect() {
  return <Navigate to="/" search={toNotesFilter} replace />;
}
