import { api } from "@convex/_generated/api";
import { FollowUpSection } from "@/features/projects/components/follow-up-section";
import { NextMoveSection } from "@/features/projects/components/next-move-section";
import { ProjectDefinitionSection } from "@/features/projects/components/project-definition-section";
import { ProjectDetailSkeleton } from "@/features/projects/components/project-detail-skeleton";
import { ProjectHeaderSection } from "@/features/projects/components/project-header-section";
import { ProjectLifecycleActionsSection } from "@/features/projects/components/project-lifecycle-actions-section";
import { ProjectLogSection } from "@/features/projects/components/project-log-section";
import { ProjectStatusCardSection } from "@/features/projects/components/project-status-card-section";
import { ThreadAreaSectionSection } from "@/features/projects/components/thread-area-section-section";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectNotFound } from "./project-not-found";

interface ProjectDetailScreenProps {
  areaSlug: string;
  projectSlug: string;
}

export function ProjectDetailScreen({
  areaSlug,
  projectSlug,
}: ProjectDetailScreenProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });

  useDocumentTitle(project?.name ?? "Thread");

  if (area === undefined || project === undefined) {
    return <ProjectDetailSkeleton />;
  }

  if (area === null || project === null || project.areaId !== area._id) {
    return <ProjectNotFound areaSlug={areaSlug} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ProjectHeaderSection areaSlug={areaSlug} projectSlug={projectSlug} />

      <ThreadAreaSectionSection areaSlug={areaSlug} projectSlug={projectSlug} />

      <ProjectStatusCardSection projectSlug={projectSlug} />

      <NextMoveSection projectSlug={projectSlug} />

      <FollowUpSection projectSlug={projectSlug} />

      <ProjectDefinitionSection projectSlug={projectSlug} />

      <ProjectLifecycleActionsSection
        areaSlug={areaSlug}
        projectSlug={projectSlug}
      />

      <ProjectLogSection projectSlug={projectSlug} />
    </div>
  );
}
