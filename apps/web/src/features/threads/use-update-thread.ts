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

export function useUpdateThread(thread: Doc<"threads">) {
  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateThread(localStore, args, { thread });
    },
  );

  return (value: UpdateThreadValue) => updateThread(value);
}
