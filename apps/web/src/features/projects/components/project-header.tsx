import { api } from "@convex/_generated/api";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ChevronRight } from "lucide-react";
import { EditableField } from "@/components/ui/editable-field";
import { optimisticallyUpdateProject } from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ProjectHeaderProps {
  areaSlug: string;
  projectSlug: string;
}

export function ProjectHeader({ areaSlug, projectSlug }: ProjectHeaderProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const navigate = useNavigate();
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );

  const handleNameSave = async (name: string) => {
    if (!name || !project) return;
    const result = await updateProject({ id: project._id, name });
    if (result?.slug) {
      navigate({
        to: "/$areaSlug/$projectSlug",
        params: { areaSlug, projectSlug: result.slug },
        replace: true,
      });
    }
  };

  if (!area || !project) return null;

  return (
    <div>
      <Link
        to="/$areaSlug"
        params={{ areaSlug }}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {area.name}
        <ChevronRight className="h-3 w-3" />
      </Link>

      <EditableField
        value={project.name}
        onSave={handleNameSave}
        className="text-xl font-semibold tracking-tight"
      />
    </div>
  );
}
