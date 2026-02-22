import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface AttentionItem {
  projectId: string;
  projectName: string;
  projectSlug: string | undefined;
  areaId: string;
  reason: "no_next_action" | "review_overdue";
  overdueBy?: number;
}

interface AttentionSectionProps {
  items: AttentionItem[];
  areas: Doc<"areas">[];
}

export function AttentionSection({ items, areas }: AttentionSectionProps) {
  const areaMap = useMemo(
    () => new Map(areas.map((a) => [a._id as string, a])),
    [areas],
  );

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <h2 className="text-sm font-medium">Needs Attention</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl bg-card">
        {items.map((item) => {
          const area = areaMap.get(item.areaId);
          const areaSlug = area?.slug ?? area?._id ?? item.areaId;
          const projectSlug = item.projectSlug ?? item.projectId;

          return (
            <Link
              key={`${item.projectId}-${item.reason}`}
              to="/$areaSlug/$projectSlug"
              params={{ areaSlug, projectSlug }}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.projectName}
                </p>
                {area && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {area.name}
                  </p>
                )}
              </div>
              {item.reason === "no_next_action" ? (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-500"
                >
                  <CircleAlert className="h-3 w-3" />
                  No next action
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-500"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Review overdue{" "}
                  {item.overdueBy
                    ? formatDistanceToNow(Date.now() - item.overdueBy)
                    : ""}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
