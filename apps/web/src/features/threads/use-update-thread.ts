import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyUpdateThread } from "@/features/threads/optimistic";

export type UpdateThreadValue = {
  id: Id<"threads">;
  title?: string;
  summary?: string | null;
  areaId?: Id<"areas">;
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
  thread: Doc<"threads">,
  options: { areas?: Doc<"areas">[] } = {},
) {
  const { areas } = options;
  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      const destinationArea =
        args.areaId === undefined
          ? undefined
          : areas?.find((area) => area._id === args.areaId);
      optimisticallyUpdateThread(localStore, args, { thread, destinationArea });
    },
  );

  return (value: UpdateThreadValue) => updateThread(value);
}
