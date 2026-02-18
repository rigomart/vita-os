import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";

const healthColors = {
  healthy: "bg-green-500",
  needs_attention: "bg-yellow-500",
  critical: "bg-red-500",
} as const;

interface AreaCardProps {
  area: Doc<"areas">;
  projectCount: number;
}

export function AreaCard({ area, projectCount }: AreaCardProps) {
  return (
    <Link
      to="/areas/$areaSlug"
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
      </div>
    </Link>
  );
}
