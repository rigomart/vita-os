import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import {
  optimisticallyCompleteNextAction,
  optimisticallyRemoveProject,
  optimisticallyUpdateProject,
} from "@/features/projects/optimistic";

interface UseProjectDetailMutationsOptions {
  projectSlug: string;
}

export function useProjectDetailMutations({
  projectSlug,
}: UseProjectDetailMutationsOptions) {
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveProject(localStore, args, { projectSlug });
    },
  );

  const completeAction = useMutation(
    api.projects.completeAction,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextAction(localStore, args, { projectSlug });
  });

  return {
    updateProject,
    removeProject,
    completeAction,
  };
}
