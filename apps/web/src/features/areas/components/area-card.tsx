import type { Doc } from "@convex/_generated/dataModel";

import { conditionColors, conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";

interface AreaCardProps {
  area: Doc<"areas">;
  threadCount: number;
  attentionCount: number;
}

export function AreaCard({ area, threadCount, attentionCount }: AreaCardProps) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug ?? area._id }}
      className="group relative rounded-xl border border-border-subtle bg-surface-2 p-5 transition-colors hover:bg-surface-3/60"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${conditionColors[area.condition]}`}
          role="img"
          aria-label={conditionLabels[area.condition]}
        />
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
