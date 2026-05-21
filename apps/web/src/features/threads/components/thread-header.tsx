import type { Doc } from "@convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { EditableField } from "@/components/ui/editable-field";

interface ThreadHeaderProps {
  area: Doc<"areas">;
  areaSlug: string;
  thread: Doc<"threads">;
  onTitleSave: (title: string) => void;
}

export function ThreadHeader({
  area,
  areaSlug,
  thread,
  onTitleSave,
}: ThreadHeaderProps) {
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
        value={thread.title}
        onSave={onTitleSave}
        className="text-xl font-semibold tracking-tight"
      />
    </div>
  );
}
