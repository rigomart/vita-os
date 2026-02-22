import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

const healthColors = {
  healthy: "bg-green-500",
  needs_attention: "bg-yellow-500",
  critical: "bg-red-500",
} as const;

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
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{area.name}</p>
        <p className="text-xs text-muted-foreground">
          {projectCount} {projectCount === 1 ? "project" : "projects"}
        </p>
        {attentionCount > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            {attentionCount} needs attention
          </p>
        )}
      </div>
    </Link>
  );
}
