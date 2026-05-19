import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { optimisticallyCompleteNextMove } from "@/features/projects/optimistic";

export function useCompleteNextMove(projectSlug: string) {
  const completeNextMoveMutation = useMutation(
    api.projects.completeNextMoveMutation,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextMove(localStore, args, { projectSlug });
  });

  return (id: Id<"projects">) => completeNextMoveMutation({ id });
}
