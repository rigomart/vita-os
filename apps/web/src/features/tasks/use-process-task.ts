import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export type ProcessTaskAction =
  | {
      type: "create_thread";
      title: string;
      areaId: Id<"areas">;
      summary?: string;
    }
  | { type: "add_activity_log_entry"; threadId: Id<"threads"> }
  | { type: "set_next_move"; threadId: Id<"threads"> };

export function useProcessTask() {
  const processTask = useMutation(api.tasks.process);

  return (id: Id<"tasks">, action: ProcessTaskAction) =>
    processTask({ id, action });
}
