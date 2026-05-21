import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";

import type { ProcessTaskAction } from "@/features/tasks/use-process-task";

import { useProcessTask } from "@/features/tasks/use-process-task";

import { ProcessTaskDialog } from "./process-task-dialog";

interface ProcessTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Doc<"tasks">;
  onProcessed?: (result: {
    action: Extract<
      ProcessTaskAction,
      { type: "create_thread" | "add_activity_log_entry" | "set_next_move" }
    >["type"];
    thread: Pick<Doc<"threads">, "title" | "slug">;
    area: Doc<"areas"> | undefined;
  }) => void;
}

export function ProcessTaskDialogContainer({
  open,
  onOpenChange,
  task,
  onProcessed,
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
        const result = await processTask(taskId, action);
        if (action.type === "create_thread" && result.type === "created") {
          onProcessed?.({
            action: action.type,
            thread: { title: action.title, slug: result.slug },
            area: visibleAreas.find((area) => area._id === action.areaId),
          });
        }
        if (
          action.type === "add_activity_log_entry" ||
          action.type === "set_next_move"
        ) {
          const thread = visibleThreads.find(
            (candidate) => candidate._id === action.threadId,
          );
          if (thread) {
            onProcessed?.({
              action: action.type,
              thread,
              area: visibleAreas.find((area) => area._id === thread.areaId),
            });
          }
        }
        onOpenChange(false);
      }}
    />
  );
}
