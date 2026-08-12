import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useMutation } from "convex/react";

import {
  patchOpenTasks,
  updateTaskWhenInInbox,
} from "@/features/tasks/optimistic";
import { optimisticallyUpdateThread } from "@/features/threads/optimistic";

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

/**
 * `source` holds the live `areas.list`/`threads.list` results the Plan
 * renders, caller-provided: the previous Area for a cross-Area drop comes
 * from the Thread document, the destination Area from the Area list — never
 * from a cache lookup. A drop naming a Thread the source no longer holds is
 * skipped outright rather than half-applied.
 */
export function usePlanActions(source: {
  areas: Doc<"areas">[];
  threads: Doc<"threads">[];
}): PlanActions {
  const feedback = useFeedback();

  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      const thread = source.threads.find(({ _id }) => _id === args.id);
      if (!thread) return;
      const destinationArea =
        args.areaId === undefined
          ? undefined
          : source.areas.find((area) => area._id === args.areaId);
      optimisticallyUpdateThread(localStore, args, { thread, destinationArea });
    },
  );

  const updateTaskWhen = useMutation(api.tasks.updateWhen).withOptimisticUpdate(
    (localStore, args) => {
      patchOpenTasks(localStore, (tasks) =>
        updateTaskWhenInInbox(tasks, args.id, args.when),
      );
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
      if (!source.threads.some((thread) => thread._id === id)) return;
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
