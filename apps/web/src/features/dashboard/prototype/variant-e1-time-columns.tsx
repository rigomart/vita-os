import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314. E1: "Time columns" — the settled layout.
 *
 * Four full-height columns under the header, each owning its own scroll, so a
 * busy column never pushes the others down and an empty one never leaves a
 * hole.
 *
 * Round 9 makes the fourth column part of the same axis. Instead of "Resting"
 * — a status bucket sitting beside three time buckets — it becomes **No date**:
 * everything unscheduled, Threads and Notes together, with Notes drawn as
 * paper so the two species stay obvious. Dated Notes keep their place under
 * their own date.
 *
 * The variable is what "undated" is allowed to mean, because it collides with
 * #236: a Thread with a Next Move and no date is unscheduled, but it is also
 * the most actionable thing on the board.
 *
 *   "strict"    — every undated thing goes to No date; Now holds only dates.
 *   "moves"     — undated Next Moves stay in Now; No date takes the rest.
 *   "sectioned" — strict, but No date is split into labelled runs inside the
 *                 column: Ready to move · Open · Notes.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";

export type NoDateMode = "moves" | "sectioned" | "strict";

export function VariantE1TimeColumns({
  areas,
  currentDate,
  header,
  noDateMode,
  notes,
  renderCard,
  renderNote,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  /** The header band, rendered above the columns. */
  header: (entries: PrototypeEntry[]) => React.ReactNode;
  /** What the No date column may take — the question this round asks. */
  noDateMode: NoDateMode;
  notes: DashboardInboxNote[];
  /** A Thread card. */
  renderCard: (entry: PrototypeEntry) => React.ReactNode;
  /** A standalone Note, drawn as paper. */
  renderNote: (entry: PrototypeEntry) => React.ReactNode;
  threads: DashboardThread[];
}) {
  const byArea = areaMap(areas);
  const threadEntries = threads.map((thread) =>
    threadEntry(thread, byArea, currentDate),
  );
  const noteEntries = notes.map(noteEntry);
  const allEntries = [...threadEntries, ...noteEntries];

  const delta = (entry: PrototypeEntry) =>
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);

  const dated = allEntries.filter((entry) => entry.when !== undefined);
  const undatedMoves = threadEntries.filter(
    (entry) => entry.when === undefined && entry.isNextMove,
  );
  const undatedOpen = threadEntries.filter(
    (entry) => entry.when === undefined && !entry.isNextMove,
  );
  const undatedNotes = noteEntries.filter((entry) => entry.when === undefined);

  /** The one disagreement between the three modes. */
  const movesStayInNow = noDateMode === "moves";

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: movesStayInNow
        ? "Late, due today, or ready to move"
        : "Late or due today",
      urgent: true,
      entries: [
        ...dated.filter((entry) => (delta(entry) ?? 1) <= 0),
        ...(movesStayInNow ? undatedMoves : []),
      ].sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity)),
    },
    {
      key: "week",
      title: "This week",
      hint: "The next six days",
      entries: dated
        .filter((entry) => {
          const d = delta(entry);
          return d !== undefined && d >= 1 && d <= 6;
        })
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      key: "later",
      title: "Later",
      hint: "Dated beyond this week",
      entries: dated
        .filter((entry) => (delta(entry) ?? 0) > 6)
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
  ];

  /** The No date column, in reading order: what you could do, then the rest. */
  const noDateSections = [
    ...(movesStayInNow
      ? []
      : [{ key: "moves", title: "Ready to move", entries: undatedMoves }]),
    { key: "open", title: "Open", entries: undatedOpen },
    { key: "notes", title: "Notes", entries: undatedNotes },
  ].filter((section) => section.entries.length > 0);

  const noDateCount = noDateSections.reduce(
    (total, section) => total + section.entries.length,
    0,
  );

  return (
    <div className="flex h-[calc(100svh-10rem)] min-h-[34rem] flex-col gap-3">
      {header(allEntries)}

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <section
            key={column.key}
            className={cn(
              "flex min-h-0 flex-col rounded-xl border",
              column.urgent
                ? "border-condition-attention/35 bg-surface-2"
                : "border-border/50",
            )}
          >
            <header className="flex items-baseline gap-2 px-2.5 pb-1.5 pt-2">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {column.entries.length}
              </span>
              <span
                title={column.hint}
                aria-hidden
                className="h-px flex-1 bg-border/40"
              />
            </header>

            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-2">
              {column.entries.map((entry) => (
                <li key={entry.id}>
                  {entry.kind === "note"
                    ? renderNote(entry)
                    : renderCard(entry)}
                </li>
              ))}
              {column.entries.length === 0 && (
                <li className="px-1 py-2 text-xs text-muted-foreground/50">
                  Nothing here.
                </li>
              )}
            </ul>
          </section>
        ))}

        <section className="flex min-h-0 flex-col rounded-xl border border-border/50">
          <header className="flex items-baseline gap-2 px-2.5 pb-1.5 pt-2">
            <h2 className="text-sm font-semibold">No date</h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {noDateCount}
            </span>
            <span
              title="Nothing scheduled — Threads and Notes alike"
              aria-hidden
              className="h-px flex-1 bg-border/40"
            />
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-2">
            {noDateSections.map((section) => (
              <section key={section.key}>
                {/* Only the sectioned mode admits to the seams inside. */}
                {noDateMode === "sectioned" && (
                  <h3 className="flex items-center gap-1.5 px-1 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55">
                    {section.title}
                    <span className="tabular-nums opacity-70">
                      {section.entries.length}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-border/30" />
                  </h3>
                )}
                <ul className="flex flex-col gap-1">
                  {section.entries.map((entry) => (
                    <li key={entry.id}>
                      {entry.kind === "note"
                        ? renderNote(entry)
                        : renderCard(entry)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {noDateCount === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground/50">
                Nothing here.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
