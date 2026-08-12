import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyCompleteNextMove } from "@/features/threads/optimistic";

export function useCompleteNextMove(thread: ProjectedThread) {
  const completeNextMoveMutation = useMutation(
    api.threads.completeNextMoveMutation,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextMove(localStore, args, { thread });
  });

  return () => completeNextMoveMutation({ id: thread._id });
}
