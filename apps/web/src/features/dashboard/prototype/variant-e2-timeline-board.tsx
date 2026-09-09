/**
 * PROTOTYPE — issue #314, round 4. E2: "Timeline board".
 *
 * D2's board — the cards and the stat strip you liked — with the missing
 * piece added: time as a *chart* rather than as layout. A 28-day bar chart
 * runs across the top (one bar per day, height = how much lands that day,
 * with a Late bucket pinned at the left), and the board underneath stays a
 * single attention-ordered run.
 *
 * So the page never becomes a plan view: the calendar is one strip you read,
 * and clicking a bar filters the board to that day rather than reorganising
 * it permanently.
 */
import { useState } from "react";

import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import {
  DAY,
  dayDelta,
  relativeDayLabel,
  startOfLocalDay,
} from "../components/dashboard-model";
import { AttentionCard } from "./attention-card";
import { byAttention } from "./dense-shared";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";
import { StatStrip } from "./stat-strip";

export const variantE2Name = "Timeline board";

const CHART_DAYS = 28;

export function VariantE2TimelineBoard({
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
  /** `-1` is the Late bucket; `null` is no filter. */
  const [selected, setSelected] = useState<number | null>(null);
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ].sort(byAttention(currentDate));

  const delta = (entry: PrototypeEntry) =>
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);

  const days = Array.from({ length: CHART_DAYS }, (_, offset) => ({
    offset,
    entries: entries.filter((entry) => delta(entry) === offset),
  }));
  const late = entries.filter((entry) => (delta(entry) ?? 1) < 0);
  const peak = Math.max(
    1,
    late.length,
    ...days.map((day) => day.entries.length),
  );

  const shown =
    selected === null
      ? entries
      : selected === -1
        ? late
        : entries.filter((entry) => delta(entry) === selected);

  return (
    <div className="flex flex-col gap-4">
      <StatStrip currentDate={currentDate} entries={entries} />

      <section
        aria-label="Next four weeks"
        className="flex items-end gap-3 rounded-xl border border-border/50 px-3 pb-2 pt-3"
      >
        <Bucket
          count={late.length}
          label="Late"
          peak={peak}
          selected={selected === -1}
          onSelect={() => setSelected(selected === -1 ? null : -1)}
          urgent
        />

        <div className="flex min-w-0 flex-1 items-end gap-px">
          {days.map((day) => {
            const date = new Date(
              startOfLocalDay(currentDate) + day.offset * DAY,
            );
            const weekStart = date.getDay() === 1;
            return (
              <button
                key={day.offset}
                type="button"
                title={`${date.toDateString()} — ${day.entries.length}`}
                onClick={() =>
                  setSelected(selected === day.offset ? null : day.offset)
                }
                className={cn(
                  "group flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-sm pb-0.5 pt-1 transition-colors hover:bg-muted/50",
                  weekStart && "border-l border-border/40",
                  selected === day.offset && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "w-full rounded-sm transition-colors",
                    day.entries.length === 0
                      ? "bg-border/40"
                      : day.offset === 0
                        ? "bg-condition-attention"
                        : day.offset <= 6
                          ? "bg-foreground/60"
                          : "bg-foreground/30",
                  )}
                  style={{
                    height: `${Math.max(2, (day.entries.length / peak) * 44)}px`,
                  }}
                />
                <span
                  className={cn(
                    "text-[9px] tabular-nums",
                    day.offset === 0
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground/50",
                  )}
                >
                  {day.offset === 0 ? "Today" : date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selected !== null && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {selected === -1
              ? "late"
              : relativeDayLabel(
                  startOfLocalDay(currentDate) + selected * DAY,
                  currentDate,
                )}
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] hover:bg-muted"
          >
            Show everything
          </button>
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((entry) => (
          <li key={entry.id}>
            <AttentionCard currentDate={currentDate} entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bucket({
  count,
  label,
  onSelect,
  peak,
  selected,
  urgent,
}: {
  count: number;
  label: string;
  onSelect: () => void;
  peak: number;
  selected: boolean;
  urgent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-12 shrink-0 flex-col items-center justify-end gap-1 rounded-sm pb-0.5 pt-1 transition-colors hover:bg-muted/50",
        selected && "bg-muted",
      )}
    >
      <span
        className={cn(
          "w-full rounded-sm",
          urgent ? "bg-condition-attention" : "bg-foreground/40",
        )}
        style={{ height: `${Math.max(2, (count / peak) * 44)}px` }}
      />
      <span
        className={cn(
          "text-[9px] uppercase tracking-wide",
          urgent ? "text-condition-attention" : "text-muted-foreground/60",
        )}
      >
        {label}
      </span>
    </button>
  );
}
