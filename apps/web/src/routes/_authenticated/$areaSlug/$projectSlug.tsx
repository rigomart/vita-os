import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteErrorFallback } from "@/components/error-boundary";
import { ActionQueue } from "@/features/projects/components/action-queue";
import { ProjectDefinitionSection } from "@/features/projects/components/project-definition-section";
import { ProjectDetailSkeleton } from "@/features/projects/components/project-detail-skeleton";
import { ProjectHeader } from "@/features/projects/components/project-header";
import { ProjectLifecycleActions } from "@/features/projects/components/project-lifecycle-actions";
import { ProjectLogSection } from "@/features/projects/components/project-log-section";
import { ProjectStatusCard } from "@/features/projects/components/project-status-card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useStableQuery } from "@/hooks/use-stable-query";

export const Route = createFileRoute("/_authenticated/$areaSlug/$projectSlug")({
  errorComponent: RouteErrorFallback,
  component: AreaProjectDetailPage,
});

function AreaProjectDetailPage() {
  const { areaSlug, projectSlug } = Route.useParams();
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  useDocumentTitle(project?.name ?? "Project");

  if (area === undefined || project === undefined) {
    return <ProjectDetailSkeleton />;
  }

  if (area === null || project === null || project.areaId !== area._id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link
          to="/$areaSlug"
          params={{ areaSlug }}
          className="mt-2 inline-block text-sm underline"
        >
          Back to area
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ProjectHeader areaSlug={areaSlug} projectSlug={projectSlug} />

      <ProjectStatusCard projectSlug={projectSlug} />

      <ActionQueue projectSlug={projectSlug} />

      <ProjectDefinitionSection projectSlug={projectSlug} />

      <ProjectLifecycleActions areaSlug={areaSlug} projectSlug={projectSlug} />

      <ProjectLogSection projectSlug={projectSlug} />
    </div>
  );
}
