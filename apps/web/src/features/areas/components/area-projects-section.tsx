import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { optimisticallyRemoveProject } from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AreaProjects } from "./area-projects";

interface AreaProjectsSectionProps {
  areaSlug: string;
  onCreateProject: () => void;
}

export function AreaProjectsSection({
  areaSlug,
  onCreateProject,
}: AreaProjectsSectionProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (!area) return;
      optimisticallyRemoveProject(localStore, args, { areaId: area._id });
    },
  );

  return (
    <AreaProjects
      areaSlug={areaSlug}
      projects={projects ?? []}
      onCreateProject={onCreateProject}
      onRemoveProject={(projectId) => removeProject({ id: projectId })}
    />
  );
}
