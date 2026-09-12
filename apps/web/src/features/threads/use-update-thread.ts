import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { AreaId, AreaSummary, Thread, ThreadId } from "@vita-os/contracts";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyUpdateThread } from "@/features/threads/optimistic";

export type UpdateThreadValue = {
  id: ThreadId;
  title?: string;
  summary?: string | null;
  areaId?: AreaId;
  nextMove?: string | null;
  followUp?: number | null;
  state?: "open" | "resolved";
  resolutionNote?: string;
};

/**
 * `options.areas` lets a caller that moves the Thread hand the destination
 * Area document to the optimistic layer, keeping the rail's embedded Area in
 * step; callers that never pass `areaId` can omit it.
 */
export function useUpdateThread(
  thread: Thread,
  options: { areas?: AreaSummary[] } = {},
) {
  const { areas } = options;
  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      const destinationArea =
        args.areaId === undefined
          ? undefined
          : areas?.find((area) => area._id === args.areaId);
      optimisticallyUpdateThread(localStore, args, {
        thread: thread as ProjectedThread,
        destinationArea: destinationArea as ProjectedArea | undefined,
      });
    },
  );

  return (value: UpdateThreadValue) =>
    updateThread({
      ...value,
      id: value.id as Id<"threads">,
      areaId: value.areaId as Id<"areas"> | undefined,
    });
}
