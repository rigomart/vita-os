import { api } from "@convex/_generated/api";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectStatusCard } from "./project-status-card";

interface ProjectStatusCardProps {
  projectSlug: string;
}

export function ProjectStatusCardSection({
  projectSlug,
}: ProjectStatusCardProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useUpdateProject(projectSlug);

  const handleSave = (status: string) => {
    if (!project) return;
    updateProject({ id: project._id, status: status || null });
  };

  return (
    <ProjectStatusCard status={project?.status ?? ""} onSave={handleSave} />
  );
}
