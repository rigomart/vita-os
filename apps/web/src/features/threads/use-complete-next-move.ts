import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyCompleteNextMove } from "@/features/threads/optimistic";

export function useCompleteNextMove(thread: Doc<"threads">) {
  const completeNextMoveMutation = useMutation(
    api.threads.completeNextMoveMutation,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextMove(localStore, args, { thread });
  });

  return () => completeNextMoveMutation({ id: thread._id });
}
