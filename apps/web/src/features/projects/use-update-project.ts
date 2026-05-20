import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { optimisticallyUpdateProject } from "@/features/projects/optimistic";

export type UpdateProjectValue = {
  id: Id<"projects">;
  name?: string;
  definitionOfDone?: string | null;
  areaId?: Id<"areas">;
  status?: string | null;
  nextMove?: string | null;
  followUp?: number | null;
  state?: "open" | "resolved";
  resolutionNote?: string;
};

export function useUpdateProject(projectSlug: string) {
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );

  return (value: UpdateProjectValue) => updateProject(value);
}
