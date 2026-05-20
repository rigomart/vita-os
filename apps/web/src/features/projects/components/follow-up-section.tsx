import { api } from "@convex/_generated/api";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { FollowUp } from "./follow-up";

interface FollowUpSectionProps {
  projectSlug: string;
}

export function FollowUpSection({ projectSlug }: FollowUpSectionProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useUpdateProject(projectSlug);

  const handleSet = (date: number) => {
    if (!project) return;
    updateProject({ id: project._id, followUp: date });
  };

  const handleClear = () => {
    if (!project) return;
    updateProject({ id: project._id, followUp: null });
  };

  return (
    <FollowUp
      followUp={project?.followUp ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
    />
  );
}
