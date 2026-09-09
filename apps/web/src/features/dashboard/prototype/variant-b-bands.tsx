/**
 * PROTOTYPE — issue #314. Variant B: "Time bands".
 *
 * #236 stance: ordering is decided by band membership, not by a global rule.
 * Today's band holds everything actionable today — overdue and today's
 * Follow-ups AND undated Threads with a Next Move — because both answer "what
 * needs attention now?". Inside the band, dated-and-late comes first, then
 * today, then the undated moves. Near-term and distant Follow-ups sit in
 * quieter bands to the side and never compete with the Today band.
 *
 * Wide viewports get three side-by-side bands; narrow stacks them with Today
 * first, so a distant Follow-up can never be the first thing on screen.
 */
import { ArrowRight } from "lucide-react";

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
  noteEntry,
  NoteMark,
  QUIET_AFTER_DAYS,
  threadEntry,
} from "./prototype-shared";

export const variantBName = "Time bands";

export function VariantBBands({
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

  const today = entries
    .filter(
      (entry) =>
        (entry.when !== undefined && dayDelta(entry.when, currentDate) <= 0) ||
        (entry.when === undefined &&
          (entry.isNextMove || entry.kind === "note")),
    )
    .sort(todayOrder(currentDate));

  const thisWeek = entries
    .filter((entry) => {
      if (entry.when === undefined) return false;
      const delta = dayDelta(entry.when, currentDate);
      return delta >= 1 && delta <= 6;
    })
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

  const later = entries
    .filter(
      (entry) =>
        entry.when !== undefined && dayDelta(entry.when, currentDate) > 6,
    )
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

  const resting = entries.filter(
    (entry) =>
      entry.kind === "thread" && entry.when === undefined && !entry.isNextMove,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Band
          accent
          title="Today"
          subtitle="Late, due, and anything you could move"
          count={today.length}
        >
          {today.map((entry) => (
            <BandRow
              key={entry.id}
              currentDate={currentDate}
              entry={entry}
              prominent
            />
          ))}
        </Band>

        <Band
          title="This week"
          subtitle="Coming up in the next six days"
          count={thisWeek.length}
        >
          {thisWeek.map((entry) => (
            <BandRow key={entry.id} currentDate={currentDate} entry={entry} />
          ))}
        </Band>

        <Band
          title="Later"
          subtitle="Beyond this week — parked, not forgotten"
          count={later.length}
          muted
        >
          {later.map((entry) => (
            <BandRow key={entry.id} currentDate={currentDate} entry={entry} />
          ))}
        </Band>
      </div>

      {resting.length > 0 && (
        <section className="border-t border-border/50 pt-3">
          <h2 className="pb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Open, no date, no move
            <span className="ml-2 tabular-nums opacity-60">
              {resting.length}
            </span>
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {resting.map((entry) => (
              <li key={entry.id}>
                <EntryLink
                  entry={entry}
                  className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <AreaMark area={entry.area} withName={false} />
                  <span>{entry.title}</span>
                  {entry.quietDays !== undefined &&
                    entry.quietDays >= QUIET_AFTER_DAYS && (
                      <span className="text-2xs text-muted-foreground/50">
                        quiet {entry.quietDays}d
                      </span>
                    )}
                </EntryLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Late first, then today's clock, then undated moves in Thread order. */
function todayOrder(currentDate: number) {
  const rank = (entry: PrototypeEntry) => {
    if (entry.when === undefined) return 2;
    return dayDelta(entry.when, currentDate) < 0 ? 0 : 1;
  };
  return (a: PrototypeEntry, b: PrototypeEntry) =>
    rank(a) - rank(b) || (a.when ?? 0) - (b.when ?? 0);
}

function Band({
  accent,
  children,
  count,
  muted,
  subtitle,
  title,
}: {
  accent?: boolean;
  children: React.ReactNode;
  count: number;
  muted?: boolean;
  subtitle: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border p-3",
        accent
          ? "border-condition-attention/40 bg-surface-2"
          : "border-border/60",
        muted && "opacity-90",
      )}
    >
      <header className="pb-2">
        <h2
          className={cn(
            "flex items-baseline gap-2 font-heading font-semibold",
            accent ? "text-base" : "text-sm",
          )}
        >
          {title}
          <span className="text-2xs tabular-nums text-muted-foreground">
            {count}
          </span>
        </h2>
        <p className="text-2xs text-muted-foreground/70">{subtitle}</p>
      </header>
      {count === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground/60">Empty.</p>
      ) : (
        <ol className="flex flex-col">{children}</ol>
      )}
    </section>
  );
}

function BandRow({
  currentDate,
  entry,
  prominent,
}: {
  currentDate: number;
  entry: PrototypeEntry;
  prominent?: boolean;
}) {
  return (
    <li>
      <EntryLink
        entry={entry}
        className="rounded-md px-2 py-1.5 hover:bg-background/70"
      >
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium",
              prominent ? "text-sm" : "text-xs",
            )}
          >
            {entry.title}
          </span>
          {entry.when !== undefined && (
            <time
              dateTime={new Date(entry.when).toISOString()}
              className={cn(
                "shrink-0 text-2xs tabular-nums",
                dateToneClassName(entry.when, currentDate),
              )}
            >
              {relativeDayLabel(entry.when, currentDate)}
            </time>
          )}
          {entry.kind === "note" ? (
            <NoteMark />
          ) : (
            <AreaMark area={entry.area} withName={false} />
          )}
        </div>
        {prominent && entry.detail && (
          <p className="flex items-baseline gap-1 truncate text-xs text-muted-foreground">
            {entry.isNextMove && (
              <ArrowRight aria-hidden className="size-3 shrink-0" />
            )}
            <span className="truncate">{entry.detail}</span>
          </p>
        )}
      </EntryLink>
    </li>
  );
}
