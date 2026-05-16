import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import {
  optimisticallyCreateProjectInArea,
  optimisticallyCreateProjectInList,
} from "@/features/projects/optimistic";
import type { CreatedProjectResult, ProjectFormValue } from "./types";

export function useCreateProject() {
  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyCreateProjectInList(localStore, args);
      optimisticallyCreateProjectInArea(localStore, args, {
        areaId: args.areaId,
      });
    },
  );

  return async (value: ProjectFormValue): Promise<CreatedProjectResult> => {
    const { slug } = await createProject(value);
    return { slug, areaId: value.areaId };
  };
}
