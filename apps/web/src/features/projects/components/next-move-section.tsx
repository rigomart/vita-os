import { api } from "@convex/_generated/api";
import { useCompleteNextMove } from "@/features/projects/use-complete-next-move";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { NextMove } from "./next-move";

interface NextMoveSectionProps {
  projectSlug: string;
}

export function NextMoveSection({ projectSlug }: NextMoveSectionProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useUpdateProject(projectSlug);
  const completeNextMove = useCompleteNextMove(projectSlug);

  const handleSet = (text: string) => {
    if (!project) return;
    updateProject({ id: project._id, nextMove: text });
  };

  const handleClear = () => {
    if (!project) return;
    updateProject({ id: project._id, nextMove: null });
  };

  const handleComplete = () => {
    if (!project) return;
    completeNextMove(project._id);
  };

  return (
    <NextMove
      nextMove={project?.nextMove ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
      onComplete={handleComplete}
    />
  );
}
