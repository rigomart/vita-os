import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { optimisticallyRemoveProject } from "@/features/projects/optimistic";

export function useRemoveProject(options: {
  projectSlug?: string;
  areaId?: Id<"areas">;
}) {
  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveProject(localStore, args, options);
    },
  );

  return (id: Id<"projects">) => removeProject({ id });
}
