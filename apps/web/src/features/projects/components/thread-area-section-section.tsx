import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ThreadAreaSection } from "@/features/projects/components/thread-area-section";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ThreadAreaSectionSectionProps {
  areaSlug: string;
  projectSlug: string;
}

export function ThreadAreaSectionSection({
  areaSlug,
  projectSlug,
}: ThreadAreaSectionSectionProps) {
  const areas = useQuery(api.areas.list);
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const navigate = useNavigate();
  const updateProject = useUpdateProject(projectSlug);

  if (!areas || !project) return null;

  const handleMove = async (areaId: Id<"areas">) => {
    if (areaId === project.areaId) return;

    await updateProject({ id: project._id, areaId });
    const targetArea = areas.find((area) => area._id === areaId);
    if (!targetArea) return;

    const nextAreaSlug = targetArea.slug ?? targetArea._id;
    if (nextAreaSlug !== areaSlug) {
      navigate({
        to: "/$areaSlug/$projectSlug",
        params: { areaSlug: nextAreaSlug, projectSlug },
        replace: true,
      });
    }
  };

  return (
    <ThreadAreaSection areas={areas} project={project} onMove={handleMove} />
  );
}
