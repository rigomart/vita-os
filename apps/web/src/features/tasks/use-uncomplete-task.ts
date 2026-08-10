import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

/**
 * Reopening a Task moves it from the `tasks.listDone` page back onto
 * `tasks.list`. Neither cache can be patched optimistically here: the Done
 * Task was never in `tasks.list` (Open Tasks only) to begin with, and
 * reconstructing its full doc to insert one would need a hook signature
 * change that's out of scope for now (see #254). Server reactivity moves
 * the Task between the two caches once the mutation lands.
 */
export function useUncompleteTask() {
  const uncompleteTask = useMutation(api.tasks.markOpen);

  return (id: Id<"tasks">) => uncompleteTask({ id });
}
