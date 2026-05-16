import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { optimisticallyCompleteNextAction } from "@/features/projects/optimistic";

export function useCompleteNextAction(projectSlug: string) {
  const completeAction = useMutation(
    api.projects.completeAction,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextAction(localStore, args, { projectSlug });
  });

  return (id: Id<"projects">) => completeAction({ id });
}
