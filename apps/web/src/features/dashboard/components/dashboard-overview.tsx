import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistance } from "date-fns";
import { History } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { PlanCanvas, PlanSchedule } from "@/features/dashboard/plan";
import { useIsCompact } from "@/hooks/use-mobile";

import { AreaConditionStrip } from "./area-condition-strip";
import {
  type DashboardArea,
  type DashboardOverviewData,
  type DashboardThread,
} from "./dashboard-model";

interface DashboardOverviewProps {
  currentDate: number;
  onCreateArea: () => void;
  overview: DashboardOverviewData;
}

export function DashboardOverview({
  overview,
  currentDate,
  onCreateArea,
}: DashboardOverviewProps) {
  const areaById = new Map(overview.areas.map((area) => [area.id, area]));
  const compact = useIsCompact();

  if (overview.areas.length === 0) {
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

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader currentDate={currentDate} />
      <AreaConditionStrip areas={overview.areas} />

      {/* Two shapes of the same Plan. A phone gets the vertical schedule; the
          branch is real, not a CSS switch, so only the mounted one runs its
          scroll and observer effects. */}
      {compact ? (
        <PlanSchedule
          areas={overview.areas}
          currentDate={currentDate}
          tasks={overview.inbox.items}
          threads={overview.threads}
        />
      ) : (
        <>
          <PlanCanvas
            areas={overview.areas}
            currentDate={currentDate}
            tasks={overview.inbox.items}
            threads={overview.threads}
          />
          {overview.recentActivity.length > 0 && (
            <RecentActivity
              entries={overview.recentActivity}
              areaById={areaById}
              threadById={
                new Map(overview.threads.map((thread) => [thread.id, thread]))
              }
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
    <section className="border-t border-border/50 pt-5">
      <div className="mb-2 flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent activity</h2>
      </div>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const thread = threadById.get(entry.threadId);
          const area = thread ? areaById.get(thread.areaId) : undefined;
          if (!thread || !area) return null;

          return (
            <Link
              key={entry.id}
              to="."
              search={(prev) => ({ ...prev, thread: thread.slug })}
              className="block min-w-0 rounded-md px-1 py-2 transition-colors hover:bg-muted/50"
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
