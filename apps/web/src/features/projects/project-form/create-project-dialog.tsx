import type { Doc, Id } from "@convex/_generated/dataModel";
import { ProjectFormDialog } from "./project-form-dialog";
import type { CreatedProjectResult } from "./types";
import { useCreateProject } from "./use-create-project";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Doc<"areas">[];
  defaultAreaId?: Id<"areas">;
  onCreated?: (project: CreatedProjectResult) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  areas,
  defaultAreaId,
  onCreated,
}: CreateProjectDialogProps) {
  const createProject = useCreateProject();

  return (
    <ProjectFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      areas={areas}
      defaultAreaId={defaultAreaId}
      onSubmit={async (value) => {
        const project = await createProject(value);
        onOpenChange(false);
        onCreated?.(project);
      }}
    />
  );
}
