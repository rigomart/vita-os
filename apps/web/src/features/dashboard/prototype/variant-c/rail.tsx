// PROTOTYPE — throwaway. Variant C's demoted secondary rail: the Inbox
// preview and Recent activity, copied verbatim from OverviewTab's private
// sub-components in dashboard-overview.tsx (they are not exported). The
// attention-ordered thread list is intentionally dropped — the lanes carry it.
import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { formatDistance } from "date-fns";
import { ChevronRight, History, Inbox } from "lucide-react";

import type {
  DashboardArea,
  DashboardOverviewData,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { taskDateLabel } from "@/features/dashboard/components/dashboard-model";
import { flatListClassName } from "@/lib/flat-surface";

/**
 * The rail keeps the Inbox to a glance; the Plan canvas alongside holds the
 * full set of Tasks, so the cap lives here — same arrangement as OverviewTab.
 */
const INBOX_PREVIEW = 3;

export function InboxSection({
  items,
  totalOpen,
  currentDate,
}: {
  items: DashboardOverviewData["inbox"]["items"];
  totalOpen: number;
  currentDate: number;
}) {
  const preview = items.slice(0, INBOX_PREVIEW);
  const remaining = Math.max(0, totalOpen - preview.length);

  return (
    <section>
      <Link
        to="/inbox"
        className="group mb-2 flex items-center gap-2 rounded-md outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Inbox className="size-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Inbox</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalOpen}
        </span>
        <ChevronRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      {totalOpen === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Inbox is clear</p>
      ) : (
        <>
          <div className={flatListClassName}>
            {preview.map((task) => (
              <div key={task.id} className="flex items-center gap-2 px-1 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {task.text}
                </span>
                {task.when != null && (
                  <Badge variant="outline">
                    {taskDateLabel(task.when, currentDate)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
          {remaining > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {remaining} more {remaining === 1 ? "Task" : "Tasks"} in Inbox
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function RecentActivity({
  entries,
  threadById,
  areaById,
  currentDate,
}: {
  entries: DashboardOverviewData["recentActivity"];
  threadById: Map<string, DashboardThread>;
  areaById: Map<string, DashboardArea>;
  currentDate: number;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent activity</h2>
      </div>
      <div className={flatListClassName}>
        {entries.map((entry) => {
          const thread = threadById.get(entry.threadId);
          const area = thread ? areaById.get(thread.areaId) : undefined;
          if (!thread || !area) return null;

          return (
            <Link
              key={entry.id}
              to="."
              search={(prev) => ({ ...prev, thread: thread.slug })}
              className="block rounded-md px-1 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-1.5">
                <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
                <p className="truncate text-sm font-medium">{thread.title}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {entry.content} ·{" "}
                {formatDistance(
                  new Date(entry.createdAt),
                  new Date(currentDate),
                  { addSuffix: true },
                )}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
