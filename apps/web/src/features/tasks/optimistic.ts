import type { Doc, Id } from "@convex/_generated/dataModel";
import { patchById } from "@/features/shared/optimistic";

export {
  completeTaskInInbox,
  isUnprocessedTask,
  removeTaskFromInbox,
  sortInboxTasks,
  uncompleteTaskInInbox,
  updateTaskWhenInInbox,
} from "@/features/tasks/inbox";

type Task = Doc<"tasks">;

export function updateTaskTextInInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
  text: string,
): T[] {
  return patchById(tasks, id, { text } as Partial<T>);
}
