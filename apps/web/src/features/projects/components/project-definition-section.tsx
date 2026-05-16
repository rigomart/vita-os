import { api } from "@convex/_generated/api";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectDefinition } from "./project-definition";

interface ProjectDefinitionSectionProps {
  projectSlug: string;
}

export function ProjectDefinitionSection({
  projectSlug,
}: ProjectDefinitionSectionProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useUpdateProject(projectSlug);

  const handleSave = (definitionOfDone: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      definitionOfDone: definitionOfDone || null,
    });
  };

  return (
    <ProjectDefinition
      definitionOfDone={project?.definitionOfDone ?? ""}
      onSave={handleSave}
    />
  );
}
