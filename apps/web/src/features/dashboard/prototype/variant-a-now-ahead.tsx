/**
 * PROTOTYPE — issue #314. Variant A: "Now / Ahead".
 *
 * #236 stance: actionability wins outright. One primary run holds everything
 * a person can act on today — overdue and today's Follow-ups, undated Threads
 * with a Next Move, Notes returning to attention — ordered by how loudly it
 * asks, not by date. Every future date leaves the run entirely and becomes a
 * forward agenda in a second column, so the main list never goes non-monotonic
 * because there are no future dates in it at all.
 */
import { ArrowRight, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta, relativeDayLabel } from "../components/dashboard-model";
import {
  AreaMark,
  areaMap,
  dateToneClassName,
  EntryLink,
  horizonOf,
  noteEntry,
  NoteMark,
  QUIET_AFTER_DAYS,
  threadEntry,
} from "./prototype-shared";

export const variantAName = "Now / Ahead";

export function VariantANowAhead({
  areas,
  currentDate,
  notes,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  notes: DashboardInboxNote[];
  threads: DashboardThread[];
}) {
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ];

  const now = entries
    .filter((entry) => horizonOf(entry.when, currentDate) === "now")
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
  const actionable = entries.filter(
    (entry) =>
      entry.when === undefined && (entry.isNextMove || entry.kind === "note"),
  );
  const ahead = entries
    .filter((entry) => {
      const horizon = horizonOf(entry.when, currentDate);
      return horizon === "soon" || horizon === "later";
    })
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
  const alsoOpen = entries.filter(
    (entry) =>
      entry.kind === "thread" && entry.when === undefined && !entry.isNextMove,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <Block
          title="Needs you now"
          count={now.length}
          tone="urgent"
          emptyLabel="Nothing is due."
        >
          {now.map((entry) => (
            <NowRow key={entry.id} currentDate={currentDate} entry={entry} />
          ))}
        </Block>

        <Block
          title="You could move these"
          count={actionable.length}
          emptyLabel="No captured next moves."
        >
          {actionable.map((entry) => (
            <NowRow key={entry.id} currentDate={currentDate} entry={entry} />
          ))}
        </Block>

        {alsoOpen.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 pb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
              Also open
              <span className="tabular-nums opacity-60">{alsoOpen.length}</span>
              <span aria-hidden className="h-px flex-1 bg-border/40" />
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {alsoOpen.map((entry) => (
                <li key={entry.id}>
                  <EntryLink
                    entry={entry}
                    className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <AreaMark area={entry.area} withName={false} />
                    <span className="truncate">{entry.title}</span>
                  </EntryLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="min-w-0 lg:border-l lg:border-border/50 lg:pl-8">
        <h2 className="pb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
          Ahead
        </h2>
        <ol className="flex flex-col">
          {ahead.map((entry, index) => (
            <AheadRow
              key={entry.id}
              currentDate={currentDate}
              entry={entry}
              showWeekRule={
                index === 0 ||
                weekBucket(ahead[index - 1]?.when, currentDate) !==
                  weekBucket(entry.when, currentDate)
              }
            />
          ))}
        </ol>
        {ahead.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
        )}
      </aside>
    </div>
  );
}

function weekBucket(when: number | undefined, currentDate: number) {
  if (when === undefined) return "none";
  const delta = dayDelta(when, currentDate);
  if (delta <= 6) return "This week";
  if (delta <= 13) return "Next week";
  if (delta <= 31) return "This month";
  return "Later";
}

function Block({
  children,
  count,
  emptyLabel,
  title,
  tone,
}: {
  children: React.ReactNode;
  count: number;
  emptyLabel: string;
  title: string;
  tone?: "urgent";
}) {
  return (
    <section>
      <h2
        className={cn(
          "flex items-center gap-2 pb-1 text-2xs font-medium uppercase tracking-wide",
          tone === "urgent"
            ? "text-condition-attention"
            : "text-muted-foreground/70",
        )}
      >
        {title}
        <span className="tabular-nums opacity-60">{count}</span>
        <span aria-hidden className="h-px flex-1 bg-border/40" />
      </h2>
      {count === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground/70">
          {emptyLabel}
        </p>
      ) : (
        <ol className="flex flex-col">{children}</ol>
      )}
    </section>
  );
}

function NowRow({
  currentDate,
  entry,
}: {
  currentDate: number;
  entry: PrototypeEntry;
}) {
  return (
    <li>
      <EntryLink
        entry={entry}
        className="rounded-md px-2 py-2 hover:bg-muted/60"
      >
        <div className="flex items-baseline gap-2">
          {entry.when !== undefined && (
            <time
              dateTime={new Date(entry.when).toISOString()}
              className={cn(
                "w-14 shrink-0 text-2xs tabular-nums",
                dateToneClassName(entry.when, currentDate),
              )}
            >
              {relativeDayLabel(entry.when, currentDate)}
            </time>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {entry.title}
          </span>
          {entry.kind === "note" ? (
            <NoteMark />
          ) : (
            <AreaMark area={entry.area} className="w-24 justify-end" />
          )}
        </div>
        {entry.detail && (
          <p
            className={cn(
              "mt-0.5 flex items-baseline gap-1 truncate text-xs text-muted-foreground",
              entry.when !== undefined && "pl-16",
            )}
          >
            {entry.isNextMove && (
              <ArrowRight aria-hidden className="size-3 shrink-0" />
            )}
            <span className="truncate">{entry.detail}</span>
            {entry.quietDays !== undefined &&
              entry.quietDays >= QUIET_AFTER_DAYS && (
                <span className="shrink-0 text-2xs text-muted-foreground/60">
                  · quiet {entry.quietDays}d
                </span>
              )}
          </p>
        )}
      </EntryLink>
    </li>
  );
}

function AheadRow({
  currentDate,
  entry,
  showWeekRule,
}: {
  currentDate: number;
  entry: PrototypeEntry;
  showWeekRule: boolean;
}) {
  return (
    <li>
      {showWeekRule && (
        <p className="mt-3 flex items-center gap-2 pb-1 text-2xs text-muted-foreground/60 first:mt-0">
          {weekBucket(entry.when, currentDate)}
          <span aria-hidden className="h-px flex-1 bg-border/30" />
        </p>
      )}
      <EntryLink
        entry={entry}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60"
      >
        <time
          dateTime={new Date(entry.when ?? 0).toISOString()}
          className="w-12 shrink-0 text-2xs tabular-nums text-muted-foreground/80"
        >
          {relativeDayLabel(entry.when ?? 0, currentDate)}
        </time>
        <span className="min-w-0 flex-1 truncate text-xs">{entry.title}</span>
        {entry.kind === "note" ? (
          <NoteMark />
        ) : (
          <AreaMark area={entry.area} withName={false} />
        )}
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground/40"
        />
      </EntryLink>
    </li>
  );
}
