import type { ProjectedArea } from "@convex/lib/validators";

import { Link } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { CircleDot } from "lucide-react";

import { flatListRowHoverClassName } from "@/lib/flat-surface";

import { AreaIcon } from "./area-icon";

interface AreaCardProps {
  area: ProjectedArea;
  threadCount: number;
  attentionCount: number;
}

export function AreaCard({ area, threadCount, attentionCount }: AreaCardProps) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      className={cn("block py-4", flatListRowHoverClassName)}
    >
      <div className="flex items-center gap-2.5">
        <AreaIcon icon={area.icon} className="size-4 shrink-0" />
        <p className="truncate font-medium">{area.name}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {threadCount} {threadCount === 1 ? "thread" : "threads"}
      </p>
      {attentionCount > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <CircleDot className="h-3 w-3" />
          {attentionCount} on Dashboard
        </p>
      )}
    </Link>
  );
}
