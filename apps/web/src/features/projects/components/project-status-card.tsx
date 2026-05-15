import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { Target } from "lucide-react";
import { EditableField } from "@/components/ui/editable-field";
import { optimisticallyUpdateProject } from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ProjectStatusCardProps {
  projectSlug: string;
}

export function ProjectStatusCard({ projectSlug }: ProjectStatusCardProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );

  const handleSave = (status: string) => {
    if (!project) return;
    updateProject({ id: project._id, status: status || null });
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Status
      </div>
      <EditableField
        value={project?.status ?? ""}
        onSave={handleSave}
        placeholder="Where things stand..."
        className="text-sm"
      />
    </div>
  );
}
