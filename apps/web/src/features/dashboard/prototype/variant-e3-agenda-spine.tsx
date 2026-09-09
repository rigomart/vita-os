import { format } from "date-fns";

import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 4. E3: "Agenda spine".
 *
 * Two panes, each doing one job, both full height so the viewport is used
 * top to bottom. The left pane is attention: cards for what is late, due, or
 * ready to move, and nothing else. The right pane is time: a real chronological
 * spine — day markers down a rule, every dated Thread and Note in order,
 * running out as far as the data goes.
 *
 * Time is legible without the page becoming a plan: the plan is a narrow
 * column you glance at, and the cards keep the width.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta, startOfLocalDay } from "../components/dashboard-model";
import { AttentionCard } from "./attention-card";
import { AreaGlyph } from "./dense-shared";
import { areaMap, EntryLink, noteEntry, threadEntry } from "./prototype-shared";
import { StatStrip } from "./stat-strip";

export const variantE3Name = "Agenda spine";

export function VariantE3AgendaSpine({
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

  const delta = (entry: PrototypeEntry) =>
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);

  const attention = entries
    .filter((entry) => {
      const d = delta(entry);
      return d !== undefined ? d <= 0 : entry.isNextMove;
    })
    .sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity));

  const resting = entries.filter(
    (entry) =>
      entry.kind === "thread" && entry.when === undefined && !entry.isNextMove,
  );

  const dated = entries
    .filter((entry) => entry.when !== undefined)
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));

  // One group per day that actually has something on it.
  const days: { entries: PrototypeEntry[]; key: number }[] = [];
  for (const entry of dated) {
    const key = startOfLocalDay(entry.when ?? 0);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, entries: [entry] });
  }

  return (
    <div className="flex h-[calc(100svh-10rem)] min-h-[34rem] flex-col gap-3">
      <StatStrip currentDate={currentDate} entries={entries} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-condition-attention">
            Needs you now
            <span className="ml-2 tabular-nums opacity-60">
              {attention.length}
            </span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {attention.map((entry) => (
              <li key={entry.id}>
                <AttentionCard currentDate={currentDate} entry={entry} />
              </li>
            ))}
          </ul>

          {resting.length > 0 && (
            <>
              <h2 className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Resting
                <span className="ml-2 tabular-nums opacity-60">
                  {resting.length}
                </span>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {resting.map((entry) => (
                  <li key={entry.id}>
                    <AttentionCard currentDate={currentDate} entry={entry} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="flex min-h-0 flex-col rounded-xl border border-border/50">
          <h2 className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            What is coming
          </h2>
          <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {days.map((day) => {
              const behind = dayDelta(day.key, currentDate) < 0;
              const isToday = dayDelta(day.key, currentDate) === 0;
              return (
                <li
                  key={day.key}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-1"
                >
                  <p
                    className={cn(
                      "pt-1.5 text-[10px] leading-tight tabular-nums",
                      behind
                        ? "text-condition-attention"
                        : isToday
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    <span className="block">
                      {format(new Date(day.key), "EEE")}
                    </span>
                    <span className="block">
                      {format(new Date(day.key), "d MMM")}
                    </span>
                  </p>
                  <ul className="flex flex-col border-l border-border/50 pb-1.5 pl-1.5">
                    {day.entries.map((entry) => (
                      <li key={entry.id}>
                        <EntryLink
                          entry={entry}
                          className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-muted/60"
                        >
                          <AreaGlyph entry={entry} />
                          <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
                            {entry.title}
                          </span>
                        </EntryLink>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
