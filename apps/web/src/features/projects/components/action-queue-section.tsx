import { api } from "@convex/_generated/api";
import { useCompleteNextAction } from "@/features/projects/use-complete-next-action";
import { useUpdateProject } from "@/features/projects/use-update-project";
import { useStableQuery } from "@/hooks/use-stable-query";
import { type ActionItem, ActionQueue } from "./action-queue";

interface ActionQueueProps {
  projectSlug: string;
}

export function ActionQueueSection({ projectSlug }: ActionQueueProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useUpdateProject(projectSlug);
  const completeAction = useCompleteNextAction(projectSlug);

  const queue = project?.actionQueue ?? [];

  const handleReorder = (items: ActionItem[]) => {
    if (!project) return;
    updateProject({ id: project._id, actionQueue: items });
  };

  const handleEdit = (itemId: string, text: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: queue.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    });
  };

  const handleAdd = (text: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: [...queue, { id: crypto.randomUUID(), text }],
    });
  };

  const handleRemove = (itemId: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: queue.filter((item) => item.id !== itemId),
    });
  };

  const handleComplete = () => {
    if (!project) return;
    completeAction(project._id);
  };

  return (
    <ActionQueue
      queue={queue}
      onReorder={handleReorder}
      onEdit={handleEdit}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onComplete={handleComplete}
    />
  );
}
