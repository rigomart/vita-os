import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { AlertTriangle, CircleAlert } from "lucide-react";

export interface AttentionListItem {
  key: string;
  projectName: string;
  projectSlug: string;
  area?: Doc<"areas">;
  areaSlug: string;
}

interface AttentionListProps {
  items: AttentionListItem[];
}

export function AttentionList({ items }: AttentionListProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <h2 className="text-sm font-medium">Needs Attention</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {items.map((item) => (
          <Link
            key={item.key}
            to="/$areaSlug/$projectSlug"
            params={{ areaSlug: item.areaSlug, projectSlug: item.projectSlug }}
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-3/60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.projectName}</p>
              {item.area && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.area.name}
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
        ))}
      </div>
    </section>
  );
}
