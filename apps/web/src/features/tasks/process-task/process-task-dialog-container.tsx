import type { ProjectedTask } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { useProcessTask } from "@/features/tasks/use-process-task";

import { ProcessTaskDialog } from "./process-task-dialog";

interface ProcessTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ProjectedTask;
}

export function ProcessTaskDialogContainer({
  open,
  onOpenChange,
  task,
}: ProcessTaskDialogProps) {
  const processTask = useProcessTask();
  const areas = useQuery(api.areas.list, open ? {} : "skip");
  const threads = useQuery(api.threads.list, open ? {} : "skip");
  const visibleAreas = areas ?? [];
  const visibleThreads = threads ?? [];
  const isLoading = open && (areas === undefined || threads === undefined);

  return (
    <ProcessTaskDialog
      open={open}
      onOpenChange={onOpenChange}
      task={task}
      areas={visibleAreas}
      threads={visibleThreads}
      isLoading={isLoading}
      onProcess={async (taskId, action) => {
        await processTask(taskId, action);
      }}
    />
  );
}
