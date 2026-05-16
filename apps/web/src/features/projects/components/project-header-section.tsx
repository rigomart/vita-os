import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectHeader } from "./project-header";

interface ProjectHeaderProps {
  areaSlug: string;
  projectSlug: string;
}

export function ProjectHeaderSection({
  areaSlug,
  projectSlug,
}: ProjectHeaderProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const navigate = useNavigate();
  const updateProject = useUpdateProject(projectSlug);

  const handleNameSave = async (name: string) => {
    if (!name || !project) return;
    const result = await updateProject({ id: project._id, name });
    if (result?.slug) {
      navigate({
        to: "/$areaSlug/$projectSlug",
        params: { areaSlug, projectSlug: result.slug },
        replace: true,
      });
    }
  };

  if (!area || !project) return null;

  return (
    <ProjectHeader
      area={area}
      areaSlug={areaSlug}
      project={project}
      onNameSave={handleNameSave}
    />
  );
}
