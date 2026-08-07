import type { Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useMutation } from "convex/react";

import { updateTaskWhenInInbox } from "@/features/tasks/optimistic";
import { optimisticallyUpdateThread } from "@/features/threads/optimistic";

import { optimisticallyPlanTask, optimisticallyPlanThread } from "./optimistic";

/**
 * The two writes the Plan canvas can make.
 *
 * Both go through the mutations the rest of the app already uses, so a drop
 * here is the same edit as one made in the Thread rail or the Inbox — Activity
 * Log entries for Follow-up changes and Area moves included. Nothing is
 * queued, staged or undoable in the canvas itself: dragging back is the undo.
 */
export interface PlanActions {
  /** Set or clear a Task's When. */
  planTask: (id: string, when: number | undefined) => void;
  /** Set or clear a Thread's Follow-up, move its Area, or both at once. */
  planThread: (
    id: string,
    change: { areaId?: string; followUp?: number | undefined },
  ) => void;
}

/** The Thread rail keeps its copy keyed by slug; the local cache knows it. */
function cachedThreadSlug(
  localStore: OptimisticLocalStore,
  id: Id<"threads">,
): string | undefined {
  const threads = localStore.getQuery(api.threads.list, {});
  return threads?.find((thread) => thread._id === id)?.slug;
}

export function usePlanActions(): PlanActions {
  const feedback = useFeedback();

  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyPlanThread(localStore, args);
      const slug = cachedThreadSlug(localStore, args.id);
      if (slug !== undefined) {
        optimisticallyUpdateThread(localStore, args, { threadSlug: slug });
      }
    },
  );

  const updateTaskWhen = useMutation(api.tasks.updateWhen).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyPlanTask(localStore, args);
      const tasks = localStore.getQuery(api.tasks.list, {});
      if (tasks !== undefined) {
        localStore.setQuery(
          api.tasks.list,
          {},
          updateTaskWhenInInbox(tasks, args.id, args.when),
        );
      }
    },
  );

  const report = () => {
    feedback.error("Could not save that change. Please try again.");
  };

  return {
    planTask: (id, when) => {
      void updateTaskWhen({ id: id as Id<"tasks">, when }).catch(report);
    },
    planThread: (id, change) => {
      void updateThread({
        id: id as Id<"threads">,
        ...(change.areaId !== undefined && {
          areaId: change.areaId as Id<"areas">,
        }),
        ...("followUp" in change && { followUp: change.followUp ?? null }),
      }).catch(report);
    },
  };
}
