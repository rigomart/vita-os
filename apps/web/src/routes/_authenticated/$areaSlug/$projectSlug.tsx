import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@/components/error-boundary";
import { ProjectDetailScreen } from "@/features/projects/project-detail/project-detail-screen";

export const Route = createFileRoute("/_authenticated/$areaSlug/$projectSlug")({
  errorComponent: RouteErrorFallback,
  component: ProjectRoute,
});

function ProjectRoute() {
  const { areaSlug, projectSlug } = Route.useParams();
  return <ProjectDetailScreen areaSlug={areaSlug} projectSlug={projectSlug} />;
}
