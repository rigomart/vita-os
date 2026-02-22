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
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium">Needs Attention</h2>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {items.length}
        </Badge>
      </div>
      <div className="rounded-lg border">
        {items.map((item, i) => {
          const area = areaMap.get(item.areaId);
          const areaSlug = area?.slug ?? area?._id ?? item.areaId;
          const projectSlug = item.projectSlug ?? item.projectId;

          return (
            <Link
              key={`${item.projectId}-${item.reason}`}
              to="/$areaSlug/$projectSlug"
              params={{ areaSlug, projectSlug }}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                i < items.length - 1 ? "border-b" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.projectName}
                </p>
                {area && (
                  <p className="text-xs text-muted-foreground">{area.name}</p>
                )}
              </div>
              {item.reason === "no_next_action" ? (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 text-[10px] text-amber-600 dark:text-amber-500"
                >
                  <CircleAlert className="h-3 w-3" />
                  No next action
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 text-[10px] text-amber-600 dark:text-amber-500"
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
    </div>
  );
}
