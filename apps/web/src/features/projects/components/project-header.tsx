import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { EditableField } from "@/components/ui/editable-field";

interface ProjectHeaderProps {
  area: Doc<"areas">;
  areaSlug: string;
  project: Doc<"projects">;
  onNameSave: (name: string) => void;
}

export function ProjectHeader({
  area,
  areaSlug,
  project,
  onNameSave,
}: ProjectHeaderProps) {
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
        onSave={onNameSave}
        className="text-xl font-semibold tracking-tight"
      />
    </div>
  );
}
