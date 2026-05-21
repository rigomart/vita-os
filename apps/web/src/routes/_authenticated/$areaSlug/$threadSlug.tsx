import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { ThreadDetailScreen } from "@/features/threads/thread-detail/thread-detail-screen";

export const Route = createFileRoute("/_authenticated/$areaSlug/$threadSlug")({
  errorComponent: RouteErrorFallback,
  component: ThreadRoute,
});

function ThreadRoute() {
  const { areaSlug, threadSlug } = Route.useParams();
  return <ThreadDetailScreen areaSlug={areaSlug} threadSlug={threadSlug} />;
}
