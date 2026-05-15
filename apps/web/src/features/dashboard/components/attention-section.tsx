import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { useMemo } from "react";

interface AttentionItem {
  projectId: string;
  projectName: string;
  projectSlug: string | undefined;
  areaId: string;
  reason: "no_next_action";
}

export function AttentionSection() {
  const attention = useQuery(api.dashboard.attention);
  const areas = useQuery(api.areas.list);

  const areaMap = useMemo(
    () => new Map((areas ?? []).map((a: Doc<"areas">) => [a._id as string, a])),
    [areas],
  );

  if (!attention || attention.items.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <h2 className="text-sm font-medium">Needs Attention</h2>
        <span className="text-xs text-muted-foreground">
          {attention.items.length}
        </span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {attention.items.map((item: AttentionItem) => {
          const area = areaMap.get(item.areaId);
          const areaSlug = area?.slug ?? area?._id ?? item.areaId;
          const projectSlug = item.projectSlug ?? item.projectId;

          return (
            <Link
              key={`${item.projectId}-${item.reason}`}
              to="/$areaSlug/$projectSlug"
              params={{ areaSlug, projectSlug }}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-3/60"
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
              <Badge
                variant="outline"
                className="shrink-0 gap-1 border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-500"
              >
                <CircleAlert className="h-3 w-3" />
                No next action
              </Badge>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
