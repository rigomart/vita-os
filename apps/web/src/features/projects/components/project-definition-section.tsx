import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { EditableField } from "@/components/ui/editable-field";
import { optimisticallyUpdateProject } from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ProjectDefinitionSectionProps {
  projectSlug: string;
}

export function ProjectDefinitionSection({
  projectSlug,
}: ProjectDefinitionSectionProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );

  const handleSave = (definitionOfDone: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      definitionOfDone: definitionOfDone || null,
    });
  };

  return (
    <div className="space-y-4">
      <MetadataRow
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Definition of Done"
      >
        <EditableField
          value={project?.definitionOfDone ?? ""}
          onSave={handleSave}
          variant="textarea"
          placeholder="What does done look like?"
          className="text-sm"
        />
      </MetadataRow>
    </div>
  );
}

function MetadataRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex w-36 shrink-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
