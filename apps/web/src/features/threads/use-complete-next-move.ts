import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyCompleteNextMove } from "@/features/threads/optimistic";

export function useCompleteNextMove(threadSlug: string) {
  const completeNextMoveMutation = useMutation(
    api.threads.completeNextMoveMutation,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextMove(localStore, args, { threadSlug });
  });

  return (id: Id<"threads">) => completeNextMoveMutation({ id });
}
