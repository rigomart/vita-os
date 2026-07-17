import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { ThreadDetailSheet } from "@/features/threads/thread-detail/thread-detail-sheet";

export const Route = createFileRoute("/_authenticated/$areaSlug/$threadSlug")({
  errorComponent: RouteErrorFallback,
  component: ThreadRoute,
});

function ThreadRoute() {
  const { areaSlug, threadSlug } = Route.useParams();
  return <ThreadDetailSheet areaSlug={areaSlug} threadSlug={threadSlug} />;
}
