import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistance } from "date-fns";
import { History } from "lucide-react";

import type { PlanActions } from "@/features/dashboard/plan/use-plan-actions";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { PlanCanvas, PlanSchedule } from "@/features/dashboard/plan";
import { useIsCompact } from "@/hooks/use-mobile";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
  DashboardThreadWithActivity,
} from "./dashboard-model";

import { AreaConditionStrip } from "./area-condition-strip";
import { recentActivity } from "./dashboard-model";

interface DashboardOverviewProps {
  areas: DashboardArea[];
  currentDate: number;
  onCreateArea: () => void;
  planActions: PlanActions;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}

export function DashboardOverview({
  areas,
  threads,
  tasks,
  currentDate,
  onCreateArea,
  planActions,
}: DashboardOverviewProps) {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const compact = useIsCompact();

  if (areas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardHeader currentDate={currentDate} />
        <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Start with a Life Area
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Add the first part of life you want Vita to help you keep in view.
          </p>
          <Button className="mt-4" onClick={onCreateArea}>
            Create Life Area
          </Button>
        </section>
      </div>
    );
  }

  const entries = recentActivity(threads);

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader currentDate={currentDate} />
      <AreaConditionStrip areas={areas} />

      {/* Two shapes of the same Plan. A phone gets the vertical schedule; the
          branch is real, not a CSS switch, so only the mounted one runs its
          scroll and observer effects. */}
      {compact ? (
        <PlanSchedule
          areas={areas}
          currentDate={currentDate}
          planActions={planActions}
          tasks={tasks}
          threads={threads}
        />
      ) : (
        <>
          <PlanCanvas
            areas={areas}
            currentDate={currentDate}
            planActions={planActions}
            tasks={tasks}
            threads={threads}
          />
          {entries.length > 0 && (
            <RecentActivity
              entries={entries}
              areaById={areaById}
              currentDate={currentDate}
            />
          )}
        </>
      )}
    </div>
  );
}

function DashboardHeader({ currentDate }: { currentDate: number }) {
  const date = new Date(currentDate);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-xl font-semibold tracking-tight">
        Life Areas
      </h1>
      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="flex min-w-12 flex-col items-end text-muted-foreground"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {format(date, "MMM")}
        </span>
        <span className="text-lg font-semibold leading-none text-foreground">
          {format(date, "d")}
        </span>
      </time>
    </header>
  );
}

function RecentActivity({
  entries,
  areaById,
  currentDate,
}: {
  entries: DashboardThreadWithActivity[];
  areaById: Map<string, DashboardArea>;
  currentDate: number;
}) {
  return (
    <section className="border-t border-border/50 pt-5">
      <div className="mb-2 flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent activity</h2>
      </div>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((thread) => {
          const area = areaById.get(thread.areaId);
          if (!area) return null;

          return (
            <Link
              key={thread.id}
              to="."
              search={(prev) => ({ ...prev, thread: thread.slug })}
              className="block min-w-0 rounded-md px-1 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-1.5">
                <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
                <p className="truncate text-sm font-medium">{thread.title}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {thread.lastActivityContent} ·{" "}
                {formatDistance(
                  new Date(thread.lastActivityAt),
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
