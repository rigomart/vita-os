import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { Separator } from "@vita-os/ui/components/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { cn } from "@vita-os/ui/lib/utils";
import { format, formatDistance } from "date-fns";
import {
  CalendarRange,
  ChevronRight,
  History,
  Inbox,
  MessagesSquare,
} from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { flatListClassName } from "@/lib/flat-surface";

import { AreaConditionOverview } from "./area-condition-overview";
import {
  type DashboardArea,
  type DashboardOverviewData,
  type DashboardThread,
  followUpDateLabel,
  getScheduleSlots,
  getScheduleTarget,
  groupDashboardThreads,
  startOfLocalDay,
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
      <AreaConditionOverview areas={overview.areas} />

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList aria-label="Dashboard view">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            overview={overview}
            areaById={areaById}
            currentDate={currentDate}
          />
        </TabsContent>
        <TabsContent value="plan">
          <PlanningSchedule
            threads={overview.threads}
            areaById={areaById}
            currentDate={currentDate}
          />
        </TabsContent>
      </Tabs>
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

function OverviewTab({
  overview,
  areaById,
  currentDate,
}: {
  overview: DashboardOverviewData;
  areaById: Map<string, DashboardArea>;
  currentDate: number;
}) {
  const groups = groupDashboardThreads(overview.threads, currentDate);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <main className="flex min-w-0 flex-col gap-6">
        {overview.threads.length === 0 ? (
          <section className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
            <h2 className="text-sm font-semibold">No open Threads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your Life Areas are clear for now.
            </p>
          </section>
        ) : (
          <>
            <ThreadSection
              heading="Overdue"
              threads={groups.overdue}
              areaById={areaById}
              currentDate={currentDate}
            />
            <ThreadSection
              heading="Threads with Next Moves"
              threads={groups.withNextMoves}
              areaById={areaById}
              currentDate={currentDate}
            />
            <ThreadSection
              heading="Upcoming"
              threads={groups.upcoming}
              areaById={areaById}
              currentDate={currentDate}
            />
            <OpenThreads
              threads={groups.open}
              areaById={areaById}
              currentDate={currentDate}
            />
          </>
        )}
      </main>

      <aside className="flex flex-col gap-6 xl:border-l xl:border-border/50 xl:pl-6">
        <InboxSection
          items={overview.inbox.items}
          totalOpen={overview.inbox.totalOpen}
          currentDate={currentDate}
        />
        {overview.recentActivity.length > 0 && (
          <>
            <Separator />
            <RecentActivity
              entries={overview.recentActivity}
              areaById={areaById}
              threadById={
                new Map(overview.threads.map((thread) => [thread.id, thread]))
              }
              currentDate={currentDate}
            />
          </>
        )}
      </aside>
    </div>
  );
}

function ThreadSection({
  heading,
  threads,
  areaById,
  currentDate,
}: {
  heading: string;
  threads: DashboardThread[];
  areaById: Map<string, DashboardArea>;
  currentDate: number;
}) {
  if (threads.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1 px-2 text-[11px] font-medium tracking-wide text-muted-foreground">
        {heading}
      </h2>
      <div className={flatListClassName}>
        {threads.map((thread) => (
          <DashboardThreadRow
            key={thread.id}
            thread={thread}
            area={areaById.get(thread.areaId)}
            currentDate={currentDate}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardThreadRow({
  thread,
  area,
  currentDate,
}: {
  thread: DashboardThread;
  area?: DashboardArea;
  currentDate: number;
}) {
  if (!area) return null;
  const context = thread.nextMove ? `Next: ${thread.nextMove}` : thread.summary;

  return (
    <Link
      to="/$areaSlug/$threadSlug"
      params={{ areaSlug: area.slug, threadSlug: thread.slug }}
      className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h3 className="text-sm font-medium">{thread.title}</h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <AreaIcon icon={area.icon} className="size-3 shrink-0" />
            {area.name}
          </span>
        </div>
        {context && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {context}
          </p>
        )}
      </div>
      {thread.followUp != null && (
        <span
          className={cn(
            "shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground",
            startOfLocalDay(thread.followUp) < startOfLocalDay(currentDate) &&
              "font-medium text-destructive",
          )}
        >
          {followUpDateLabel(thread.followUp, currentDate)}
        </span>
      )}
    </Link>
  );
}

function OpenThreads({
  threads,
  areaById,
  currentDate,
}: {
  threads: DashboardThread[];
  areaById: Map<string, DashboardArea>;
  currentDate: number;
}) {
  if (threads.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
          />
        }
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <ChevronRight
            data-icon="inline-start"
            className="transition-transform group-data-[state=open]/button:rotate-90"
          />
          Open Threads
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {threads.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className={flatListClassName}>
          {threads.map((thread) => (
            <DashboardThreadRow
              key={thread.id}
              thread={thread}
              area={areaById.get(thread.areaId)}
              currentDate={currentDate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function InboxSection({
  items,
  totalOpen,
  currentDate,
}: {
  items: DashboardOverviewData["inbox"]["items"];
  totalOpen: number;
  currentDate: number;
}) {
  const remaining = Math.max(0, totalOpen - items.length);

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
            {items.map((task) => (
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
              to="/$areaSlug/$threadSlug"
              params={{ areaSlug: area.slug, threadSlug: thread.slug }}
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

function PlanningSchedule({
  currentDate,
  threads,
  areaById,
}: {
  currentDate: number;
  threads: DashboardThread[];
  areaById: Map<string, DashboardArea>;
}) {
  const slots = getScheduleSlots(currentDate);
  const undated = threads.filter((thread) => thread.followUp == null);

  return (
    <section aria-labelledby="schedule-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" />
        <h2 id="schedule-heading" className="text-sm font-semibold">
          Schedule
        </h2>
      </div>

      {threads.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No open Threads to plan.
        </p>
      ) : (
        <>
          <div className="grid border-y border-border/70 md:grid-cols-3 xl:grid-cols-6">
            {slots.map((slot, index) => {
              const matching = threads.filter(
                (thread) =>
                  getScheduleTarget(thread.followUp, currentDate) === slot.key,
              );
              return (
                <div
                  key={slot.key}
                  className={cn(
                    "min-w-0 border-t border-border/70 px-2 py-3 first:border-t-0 md:border-t-0 md:border-l",
                    index === 0 && "md:border-l-0",
                  )}
                >
                  <h3 className="mb-2 text-xs font-semibold">{slot.label}</h3>
                  <div className="flex min-h-20 flex-col items-start gap-1.5">
                    {matching.map((thread) => (
                      <PlanThreadLink
                        key={thread.id}
                        thread={thread}
                        area={areaById.get(thread.areaId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
              <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
              <span>No date</span>
              <span className="tabular-nums">{undated.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {undated.map((thread) => (
                  <PlanThreadLink
                    key={thread.id}
                    thread={thread}
                    area={areaById.get(thread.areaId)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </section>
  );
}

function PlanThreadLink({
  thread,
  area,
}: {
  thread: DashboardThread;
  area?: DashboardArea;
}) {
  if (!area) return null;

  return (
    <Link
      to="/$areaSlug/$threadSlug"
      params={{ areaSlug: area.slug, threadSlug: thread.slug }}
      className="inline-flex h-7 max-w-full items-center justify-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <MessagesSquare className="size-3.5 shrink-0" />
      <span className="truncate">{thread.title}</span>
      <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
    </Link>
  );
}
