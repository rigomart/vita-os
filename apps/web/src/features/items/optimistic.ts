import type { Doc, Id } from "@convex/_generated/dataModel";
import { patchById } from "@/features/shared/optimistic";
import {
  completeTaskInInbox,
  isUnprocessedTask,
  removeTaskFromInbox,
  sortInboxTasks,
  uncompleteTaskInInbox,
  updateTaskWhenInInbox,
} from "@/features/tasks/inbox";

type Task = Doc<"items">;

export const sortInboxItems = sortInboxTasks;
export const completeItemInInbox = completeTaskInInbox;
export const uncompleteItemInInbox = uncompleteTaskInInbox;
export const removeItemFromInbox = removeTaskFromInbox;
export const updateItemDateInInbox = updateTaskWhenInInbox;
export const isUnprocessedItem = isUnprocessedTask;

export function updateItemTextInInbox<T extends Task>(
  items: T[],
  id: Id<"items">,
  text: string,
): T[] {
  return patchById(items, id, { text } as Partial<T>);
}
