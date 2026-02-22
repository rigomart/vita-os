import type { Doc } from "@convex/_generated/dataModel";
import { healthColors, healthLabels } from "@convex/lib/types";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

interface AreaCardProps {
  area: Doc<"areas">;
  projectCount: number;
  attentionCount: number;
}

export function AreaCard({
  area,
  projectCount,
  attentionCount,
}: AreaCardProps) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug ?? area._id }}
      className="group relative rounded-xl bg-surface-2 p-5 transition-colors hover:bg-surface-3/60"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
          role="img"
          aria-label={healthLabels[area.healthStatus]}
        />
        <p className="truncate font-medium">{area.name}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </p>
      {attentionCount > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-500">
          <AlertTriangle className="h-3 w-3" />
          {attentionCount} needs attention
        </p>
      )}
    </Link>
  );
}
