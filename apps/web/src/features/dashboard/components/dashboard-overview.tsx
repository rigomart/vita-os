import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistance } from "date-fns";
import { ChevronRight, History, Inbox } from "lucide-react";
import { useState } from "react";

import { PrototypeVariants } from "@/components/dev/prototype-variants";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  AttentionEmpty,
  AttentionList,
  AttentionRow,
  type AttentionRowModel,
} from "@/features/attention-list";
import { PlanCanvas } from "@/features/dashboard/plan";
import { PlanVariantCalendar } from "@/features/dashboard/prototype/variant-b2-calendar";
import { PlanVariantGlance } from "@/features/dashboard/prototype/variant-b2a-glance";
import { PlanVariantBlocks } from "@/features/dashboard/prototype/variant-b2b-blocks";
import { PlanVariantWeeks } from "@/features/dashboard/prototype/variant-b2c-weeks";
import { flatListClassName } from "@/lib/flat-surface";

import { AreaConditionStrip } from "./area-condition-strip";
import {
  type DashboardArea,
  type DashboardOverviewData,
  type DashboardThread,
  groupDashboardThreads,
  taskDateLabel,
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

      <div className="hidden sm:flex sm:flex-col sm:gap-6">
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
      </div>

      {/* PROTOTYPE — throwaway (issue #268): structural layout variants for the
          < sm plan view, switchable via ?variant=. "current" is the interim
          list that shipped with #269. See features/dashboard/prototype/README.md. */}
      <div className="flex flex-col gap-6 sm:hidden">
        <PrototypeVariants
          variants={[
            {
              key: "current",
              name: "Current list",
              render: () => (
                <div className="flex flex-col gap-6">
                  <DashboardThreadList
                    threads={overview.threads}
                    areaById={areaById}
                    currentDate={currentDate}
                  />
                  <InboxSection
                    items={overview.inbox.items}
                    totalOpen={overview.inbox.totalOpen}
                    currentDate={currentDate}
                  />
                </div>
              ),
            },
            {
              key: "b2",
              name: "Calendar schedule",
              render: () => (
                <PlanVariantCalendar
                  areas={overview.areas}
                  currentDate={currentDate}
                  tasks={overview.inbox.items}
                  threads={overview.threads}
                />
              ),
            },
            {
              key: "b2a",
              name: "Glanceable schedule",
              render: () => (
                <PlanVariantGlance
                  areas={overview.areas}
                  currentDate={currentDate}
                  tasks={overview.inbox.items}
                  threads={overview.threads}
                />
              ),
            },
            {
              key: "b2b",
              name: "Event blocks",
              render: () => (
                <PlanVariantBlocks
                  areas={overview.areas}
                  currentDate={currentDate}
                  tasks={overview.inbox.items}
                  threads={overview.threads}
                />
              ),
            },
            {
              key: "b2c",
              name: "Week sections",
              render: () => (
                <PlanVariantWeeks
                  areas={overview.areas}
                  currentDate={currentDate}
                  tasks={overview.inbox.items}
                  threads={overview.threads}
                />
              ),
            },
          ]}
        />
      </div>
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

const OPEN_THREAD_CAP = 5;

function DashboardThreadList({
  areaById,
  currentDate,
  threads,
}: {
  areaById: Map<string, DashboardArea>;
  currentDate: number;
  threads: DashboardThread[];
}) {
  const [showAllOpen, setShowAllOpen] = useState(false);

  if (threads.length === 0) {
    return <AttentionEmpty>Your Life Areas are clear for now.</AttentionEmpty>;
  }

  const groups = groupDashboardThreads(threads, currentDate);
  const visibleOpen = showAllOpen
    ? groups.open
    : groups.open.slice(0, OPEN_THREAD_CAP);
  const hiddenOpenCount = groups.open.length - visibleOpen.length;
  const flatThreads = [
    ...groups.overdue,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...visibleOpen,
  ];

  return (
    <AttentionList>
      {flatThreads.map((thread) => {
        const area = areaById.get(thread.areaId);
        if (!area) return null;

        const row: AttentionRowModel = {
          title: thread.title,
          detail: thread.nextMove ?? thread.summary,
          detailKind: thread.nextMove ? "next-move" : "summary",
          area: { icon: area.icon, name: area.name },
          when: thread.followUp,
          linkTo: { threadSlug: thread.slug },
        };

        return <AttentionRow key={thread.id} now={currentDate} row={row} />;
      })}
      {hiddenOpenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllOpen(true)}
          className="flex w-full items-center gap-2 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
          Show all
          <span className="tabular-nums opacity-60">
            {hiddenOpenCount} more
          </span>
          <div className="ml-1 h-px flex-1 bg-border/40" />
        </button>
      )}
    </AttentionList>
  );
}

/**
 * The mobile dashboard keeps the Inbox to a glance; the Plan canvas is what
 * needs the full set of Tasks, so the query hands over every Open Task and
 * the cap lives here — the same arrangement plain Open Threads use above.
 */
const INBOX_PREVIEW = 3;

function InboxSection({
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
