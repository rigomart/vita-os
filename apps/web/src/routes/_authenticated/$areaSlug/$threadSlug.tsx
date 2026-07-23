import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { ThreadDetailView } from "@/features/threads/thread-detail/thread-detail-view";

export const Route = createFileRoute("/_authenticated/$areaSlug/$threadSlug")({
  errorComponent: RouteErrorFallback,
  component: ThreadRoute,
});

function ThreadRoute() {
  const { areaSlug, threadSlug } = Route.useParams();
  return <ThreadDetailView areaSlug={areaSlug} threadSlug={threadSlug} />;
}
