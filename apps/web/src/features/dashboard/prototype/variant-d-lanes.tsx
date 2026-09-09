/**
 * PROTOTYPE — issue #314. Variant D: "Area lanes".
 *
 * #236 stance: the global ordering question mostly dissolves. The only list
 * ordered by attention is the strip across the top ("Needs you now"), which
 * takes overdue and today's Follow-ups plus the loudest undated Next Move per
 * Area, late first. Below it, space is organised by Area rather than by time,
 * and each lane orders its own items dated-soonest → moves → resting. A
 * distant Follow-up is never near the top of the page; it is one quiet chip
 * inside its Area's lane, and the lane header carries the Area's next date.
 *
 * Standalone Notes returning to attention get their own lane, so the global
 * Notes surface stays standalone-only.
 */
import { conditionLabels } from "@convex/lib/condition";
import { ArrowRight } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta, relativeDayLabel } from "../components/dashboard-model";
import {
  areaMap,
  dateToneClassName,
  EntryLink,
  noteEntry,
  NoteMark,
  QUIET_AFTER_DAYS,
  threadEntry,
} from "./prototype-shared";

export const variantDName = "Area lanes";

export function VariantDLanes({
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
  const threadEntries = threads.map((thread) =>
    threadEntry(thread, byArea, currentDate),
  );
  const noteEntries = notes.map(noteEntry);

  const dueNow = [...threadEntries, ...noteEntries]
    .filter(
      (entry) =>
        entry.when !== undefined && dayDelta(entry.when, currentDate) <= 0,
    )
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

  // One undated move per Area, so the strip stays a strip.
  const featuredMoves = areas
    .map((area) =>
      threadEntries.find(
        (entry) =>
          entry.area?.id === area.id &&
          entry.when === undefined &&
          entry.isNextMove,
      ),
    )
    .filter((entry): entry is PrototypeEntry => entry !== undefined);

  const strip = [...dueNow, ...featuredMoves];
  const stripIds = new Set(strip.map((entry) => entry.id));

  const lanes = [...areas]
    .sort(worstFirst)
    .map((area) => ({
      area,
      entries: threadEntries
        .filter((entry) => entry.area?.id === area.id)
        .sort(laneOrder(currentDate)),
    }))
    .filter((lane) => lane.entries.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Needs you now"
        className="rounded-xl border border-condition-attention/40 bg-surface-2 p-3"
      >
        <h2 className="pb-2 font-heading text-base font-semibold">
          Needs you now
          <span className="ml-2 text-2xs tabular-nums text-muted-foreground">
            {strip.length}
          </span>
        </h2>
        {strip.length === 0 ? (
          <p className="text-xs text-muted-foreground">Clear.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {strip.map((entry) => (
              <li key={entry.id}>
                <EntryLink
                  entry={entry}
                  className="h-full rounded-lg border border-border/50 bg-background p-2.5 hover:border-border"
                >
                  <div className="flex items-center gap-2">
                    {entry.when !== undefined ? (
                      <time
                        dateTime={new Date(entry.when).toISOString()}
                        className={cn(
                          "shrink-0 text-2xs tabular-nums",
                          dateToneClassName(entry.when, currentDate),
                        )}
                      >
                        {relativeDayLabel(entry.when, currentDate)}
                      </time>
                    ) : (
                      <span className="shrink-0 text-2xs text-muted-foreground/60">
                        No date
                      </span>
                    )}
                    <span aria-hidden className="flex-1" />
                    {entry.kind === "note" ? (
                      <NoteMark />
                    ) : (
                      <AreaTag area={entry.area} />
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {entry.title}
                  </p>
                  {entry.detail && (
                    <p className="mt-0.5 flex items-baseline gap-1 text-xs text-muted-foreground">
                      {entry.isNextMove && (
                        <ArrowRight aria-hidden className="size-3 shrink-0" />
                      )}
                      <span className="truncate">{entry.detail}</span>
                    </p>
                  )}
                </EntryLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {lanes.map(({ area, entries }) => (
          <Lane
            key={area.id}
            area={area}
            currentDate={currentDate}
            entries={entries}
            stripIds={stripIds}
          />
        ))}

        {noteEntries.length > 0 && (
          <section className="min-w-0">
            <header className="flex items-baseline gap-1.5 border-b border-border/50 pb-1">
              <NoteMark />
              <h2 className="text-sm font-semibold">Notes</h2>
              <span className="text-2xs tabular-nums text-muted-foreground/70">
                {noteEntries.length}
              </span>
            </header>
            <ol className="flex flex-col pt-1">
              {noteEntries.sort(laneOrder(currentDate)).map((entry) => (
                <LaneRow
                  key={entry.id}
                  currentDate={currentDate}
                  entry={entry}
                  dimmed={stripIds.has(entry.id)}
                />
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

/** Dated soonest first, then undated moves, then everything resting. */
function laneOrder(currentDate: number) {
  const rank = (entry: PrototypeEntry) => {
    if (entry.when !== undefined) return 0;
    return entry.isNextMove ? 1 : 2;
  };
  return (a: PrototypeEntry, b: PrototypeEntry) =>
    rank(a) - rank(b) ||
    (a.when ?? 0) - (b.when ?? 0) ||
    (a.thread?.order ?? 0) - (b.thread?.order ?? 0) ||
    dayDelta(a.when ?? currentDate, b.when ?? currentDate);
}

function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) =>
    area.condition === "critical" ? 0 : area.condition === "needs_attention" ? 1 : 2;
  return rank(a) - rank(b) || a.order - b.order;
}

function Lane({
  area,
  currentDate,
  entries,
  stripIds,
}: {
  area: DashboardArea;
  currentDate: number;
  entries: PrototypeEntry[];
  stripIds: Set<string>;
}) {
  const soonest = entries.find((entry) => entry.when !== undefined)?.when;

  return (
    <section className="min-w-0">
      <header className="flex items-baseline gap-1.5 border-b border-border/50 pb-1">
        <AreaIcon
          icon={area.icon}
          className={cn(
            "size-4 shrink-0 translate-y-0.5",
            conditionTextClassName[area.condition],
          )}
        />
        <h2 className="truncate text-sm font-semibold">{area.name}</h2>
        <span
          className={cn(
            "text-2xs",
            conditionTextClassName[area.condition],
            area.condition === "healthy" && "text-muted-foreground/60",
          )}
        >
          {conditionLabels[area.condition]}
        </span>
        <span aria-hidden className="flex-1" />
        {soonest !== undefined && (
          <time
            dateTime={new Date(soonest).toISOString()}
            className={cn(
              "shrink-0 text-2xs tabular-nums",
              dateToneClassName(soonest, currentDate),
            )}
          >
            next {relativeDayLabel(soonest, currentDate)}
          </time>
        )}
      </header>
      <ol className="flex flex-col pt-1">
        {entries.map((entry) => (
          <LaneRow
            key={entry.id}
            currentDate={currentDate}
            entry={entry}
            dimmed={stripIds.has(entry.id)}
          />
        ))}
      </ol>
    </section>
  );
}

function LaneRow({
  currentDate,
  dimmed,
  entry,
}: {
  currentDate: number;
  dimmed: boolean;
  entry: PrototypeEntry;
}) {
  return (
    <li>
      <EntryLink
        entry={entry}
        className={cn(
          "flex items-baseline gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60",
          dimmed && "opacity-45",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-xs">
          {entry.isNextMove && (
            <ArrowRight
              aria-hidden
              className="mr-1 inline size-3 shrink-0 translate-y-0.5 text-muted-foreground/70"
            />
          )}
          {entry.title}
        </span>
        {entry.quietDays !== undefined &&
          entry.quietDays >= QUIET_AFTER_DAYS && (
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
              {entry.quietDays}d
            </span>
          )}
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
      </EntryLink>
    </li>
  );
}

function AreaTag({ area }: { area?: DashboardArea }) {
  if (!area) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-2xs",
        conditionTextClassName[area.condition],
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5" />
      <span className="truncate">{area.name}</span>
    </span>
  );
}
