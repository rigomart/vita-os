/**
 * PROTOTYPE — issue #314. Variant C: "Horizon ribbon".
 *
 * #236 stance: the in-between option. Only near-term Follow-ups (today and the
 * next two days) outrank undated Threads with a Next Move. Everything dated
 * further out drops below the plain open Threads into a quiet "Scheduled"
 * shelf, because a date three weeks away is awareness, not attention.
 *
 * Temporal awareness lives in a 21-day ribbon across the top rather than in
 * the list order: the extra horizontal space carries the calendar so the list
 * underneath can stay a pure attention ranking. Clicking a day filters the
 * shelf to that day.
 */
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import {
  dayDelta,
  relativeDayLabel,
  startOfLocalDay,
} from "../components/dashboard-model";
import {
  AreaMark,
  areaMap,
  dateToneClassName,
  EntryLink,
  NEAR_TERM_DAYS,
  noteEntry,
  NoteMark,
  QUIET_AFTER_DAYS,
  threadEntry,
} from "./prototype-shared";

export const variantCName = "Horizon ribbon";

const RIBBON_DAYS = 21;

export function VariantCRibbon({
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ];

  const near = entries
    .filter(
      (entry) =>
        entry.when !== undefined &&
        dayDelta(entry.when, currentDate) <= NEAR_TERM_DAYS,
    )
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
  const moves = entries.filter(
    (entry) =>
      entry.when === undefined && (entry.isNextMove || entry.kind === "note"),
  );
  const open = entries.filter(
    (entry) =>
      entry.kind === "thread" && entry.when === undefined && !entry.isNextMove,
  );
  const scheduled = entries
    .filter(
      (entry) =>
        entry.when !== undefined &&
        dayDelta(entry.when, currentDate) > NEAR_TERM_DAYS,
    )
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

  const shelf =
    selectedDay === null
      ? scheduled
      : scheduled.filter(
          (entry) => dayDelta(entry.when ?? 0, currentDate) === selectedDay,
        );

  return (
    <div className="flex flex-col gap-5">
      <HorizonRibbon
        currentDate={currentDate}
        entries={entries}
        onSelect={(delta) =>
          setSelectedDay((previous) => (previous === delta ? null : delta))
        }
        selectedDay={selectedDay}
      />

      <section>
        <SectionRule
          label="Now"
          count={near.length + moves.length}
          tone="urgent"
        />
        <ol className="flex flex-col">
          {[...near, ...moves].map((entry) => (
            <DenseRow key={entry.id} currentDate={currentDate} entry={entry} />
          ))}
        </ol>
      </section>

      {open.length > 0 && (
        <section>
          <SectionRule label="Open" count={open.length} />
          <ol className="flex flex-col">
            {open.map((entry) => (
              <DenseRow
                key={entry.id}
                currentDate={currentDate}
                entry={entry}
              />
            ))}
          </ol>
        </section>
      )}

      {scheduled.length > 0 && (
        <section>
          <SectionRule
            label={
              selectedDay === null
                ? "Scheduled"
                : `Scheduled · ${relativeDayLabel(
                    startOfLocalDay(currentDate) + selectedDay * 86_400_000,
                    currentDate,
                  )}`
            }
            count={shelf.length}
          />
          <ol className="flex flex-col opacity-80">
            {shelf.map((entry) => (
              <DenseRow
                key={entry.id}
                currentDate={currentDate}
                entry={entry}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function HorizonRibbon({
  currentDate,
  entries,
  onSelect,
  selectedDay,
}: {
  currentDate: number;
  entries: PrototypeEntry[];
  onSelect: (delta: number) => void;
  selectedDay: number | null;
}) {
  const start = startOfLocalDay(currentDate);
  const overdue = entries.filter(
    (entry) =>
      entry.when !== undefined && dayDelta(entry.when, currentDate) < 0,
  );
  const beyond = entries.filter(
    (entry) =>
      entry.when !== undefined &&
      dayDelta(entry.when, currentDate) >= RIBBON_DAYS,
  );

  return (
    <section
      aria-label="Next three weeks"
      className="flex items-stretch gap-2 rounded-xl border border-border/60 bg-surface-2 p-2"
    >
      <RibbonEdge
        label="Late"
        count={overdue.length}
        tone="urgent"
        selected={selectedDay === -1}
        onSelect={() => onSelect(-1)}
      />
      <div className="flex min-w-0 flex-1 gap-px overflow-x-auto">
        {Array.from({ length: RIBBON_DAYS }, (_, delta) => {
          const dayStart = start + delta * 86_400_000;
          const dayEntries = entries.filter(
            (entry) =>
              entry.when !== undefined &&
              dayDelta(entry.when, currentDate) === delta,
          );
          const date = new Date(dayStart);
          const weekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <button
              key={delta}
              type="button"
              onClick={() => onSelect(delta)}
              title={date.toDateString()}
              className={cn(
                "flex min-w-7 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1 text-center transition-colors hover:bg-muted/70",
                weekend && "bg-muted/30",
                selectedDay === delta && "bg-muted ring-1 ring-ring/40",
              )}
            >
              <span
                className={cn(
                  "text-[9px] tabular-nums",
                  delta === 0
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground/70",
                )}
              >
                {delta === 0 ? "Today" : date.getDate()}
              </span>
              <span className="flex min-h-6 flex-col items-center gap-0.5">
                {dayEntries.slice(0, 3).map((entry) => (
                  <span
                    key={entry.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      entry.kind === "note"
                        ? "border border-muted-foreground/70"
                        : delta <= NEAR_TERM_DAYS
                          ? "bg-condition-attention"
                          : "bg-foreground/45",
                    )}
                  />
                ))}
                {dayEntries.length > 3 && (
                  <span className="text-[8px] tabular-nums text-muted-foreground">
                    +{dayEntries.length - 3}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <RibbonEdge
        label="Beyond"
        count={beyond.length}
        selected={false}
        onSelect={() => onSelect(RIBBON_DAYS)}
      />
    </section>
  );
}

function RibbonEdge({
  count,
  label,
  onSelect,
  selected,
  tone,
}: {
  count: number;
  label: string;
  onSelect: () => void;
  selected: boolean;
  tone?: "urgent";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border/50 px-1 py-1 text-center transition-colors hover:bg-muted/70",
        selected && "bg-muted",
      )}
    >
      <span
        className={cn(
          "text-[9px] uppercase tracking-wide",
          tone === "urgent"
            ? "text-condition-attention"
            : "text-muted-foreground/70",
        )}
      >
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums">{count}</span>
    </button>
  );
}

function SectionRule({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone?: "urgent";
}) {
  return (
    <h2
      className={cn(
        "flex items-center gap-2 pb-1 text-2xs font-medium uppercase tracking-wide",
        tone === "urgent"
          ? "text-condition-attention"
          : "text-muted-foreground/70",
      )}
    >
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
      <span aria-hidden className="h-px flex-1 bg-border/40" />
    </h2>
  );
}

function DenseRow({
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
        className="flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
      >
        {entry.when === undefined ? (
          <span
            aria-label="No date"
            className="w-14 shrink-0 text-right text-2xs text-muted-foreground/30"
          >
            —
          </span>
        ) : (
          <time
            dateTime={new Date(entry.when).toISOString()}
            className={cn(
              "w-14 shrink-0 text-right text-2xs tabular-nums",
              dateToneClassName(entry.when, currentDate),
            )}
          >
            {relativeDayLabel(entry.when, currentDate)}
          </time>
        )}

        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            entry.detail ? "max-w-[42%] shrink-0" : "flex-1",
          )}
        >
          {entry.title}
        </span>

        {entry.detail && (
          <span className="flex min-w-0 flex-1 items-baseline gap-1 text-xs text-muted-foreground/80">
            {entry.isNextMove && (
              <ArrowRight
                aria-hidden
                className="size-3 shrink-0 translate-y-0.5"
              />
            )}
            <span className="truncate">{entry.detail}</span>
          </span>
        )}

        {/* Wide viewports get the last thing that happened, not just the plan. */}
        {entry.thread?.lastActivityContent && (
          <span className="hidden min-w-0 max-w-[22%] shrink-0 truncate text-2xs text-muted-foreground/55 2xl:block">
            {entry.thread.lastActivityContent}
          </span>
        )}

        {entry.quietDays !== undefined &&
          entry.quietDays >= QUIET_AFTER_DAYS && (
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
              quiet {entry.quietDays}d
            </span>
          )}

        {entry.kind === "note" ? (
          <NoteMark />
        ) : (
          <AreaMark
            area={entry.area}
            className="hidden w-24 justify-end sm:flex"
          />
        )}
      </EntryLink>
    </li>
  );
}
