import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "@/features/areas/optimistic";
import {
  optimisticallyCreateProjectInArea,
  optimisticallyRemoveProject,
} from "@/features/projects/optimistic";

interface UseAreaDetailMutationsOptions {
  areaSlug: string;
  areaId?: Id<"areas">;
}

export function useAreaDetailMutations({
  areaSlug,
  areaId,
}: UseAreaDetailMutationsOptions) {
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args, { areaSlug });
    },
  );

  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveArea(localStore, args, { areaSlug });
    },
  );

  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      if (areaId === undefined) return;
      optimisticallyCreateProjectInArea(localStore, args, { areaId });
    },
  );

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (areaId === undefined) return;
      optimisticallyRemoveProject(localStore, args, { areaId });
    },
  );

  return {
    updateArea,
    removeArea,
    createProject,
    removeProject,
  };
}
