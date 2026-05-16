import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useRemoveProject } from "@/features/projects/use-remove-project";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectLifecycleActions } from "./project-lifecycle-actions";

interface ProjectLifecycleActionsProps {
  areaSlug: string;
  projectSlug: string;
}

export function ProjectLifecycleActionsSection({
  areaSlug,
  projectSlug,
}: ProjectLifecycleActionsProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const navigate = useNavigate();
  const updateProject = useUpdateProject(projectSlug);
  const removeProject = useRemoveProject({ projectSlug });

  const handleStateChange = (state: "completed" | "dropped") => {
    if (!project) return;
    updateProject({ id: project._id, state });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  const handleDelete = async () => {
    if (!project) return;
    await removeProject(project._id);
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  if (!project) return null;

  return (
    <ProjectLifecycleActions
      project={project}
      onComplete={() => handleStateChange("completed")}
      onDrop={() => handleStateChange("dropped")}
      onDelete={handleDelete}
    />
  );
}
