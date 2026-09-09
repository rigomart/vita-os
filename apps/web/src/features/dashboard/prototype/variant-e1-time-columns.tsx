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
 * Settled at P3: strict about dates — Now holds only what is late or due, and
 * every unscheduled thing goes to No date, which admits its own seams as
 * labelled runs (Ready to move · Open · Notes). That is also the answer to
 * #236: a date outranks an undated Next Move, which keeps its own billing one
 * column over.
 *
 * Because No date is *not* a time bucket, it is drawn as an aside rather than
 * a fourth peer: the three time columns are a group with a rule and a wide gap
 * between them and it, and the aside drops the card border and the panel
 * background so it reads as margin, not as another column in the sequence.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";

export function VariantE1TimeColumns({
  areas,
  currentDate,
  header,
  notes,
  renderCard,
  renderNote,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  /** The header band, rendered above the columns. */
  header: (entries: PrototypeEntry[]) => React.ReactNode;
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

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: "Late or due today",
      urgent: true,
      entries: dated
        .filter((entry) => (delta(entry) ?? 1) <= 0)
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
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
    { key: "moves", title: "Ready to move", entries: undatedMoves },
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

      {/* The three time columns are one group; the aside sits outside it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        </div>

        {/* Not a time bucket, so not a fourth column: no panel, no card edge,
            just a ruled margin the unscheduled things live in. */}
        <aside className="flex min-h-0 flex-col xl:w-[17rem] xl:shrink-0 xl:border-l xl:border-border/60 xl:pl-4">
          <header className="flex items-baseline gap-2 border-t border-border/60 pb-1.5 pt-2 xl:border-t-0 xl:pt-0">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              No date
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/50">
              {noDateCount}
            </span>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
            {noDateSections.map((section) => (
              <section key={section.key}>
                <h3 className="flex items-center gap-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/45">
                  {section.title}
                  <span className="tabular-nums">{section.entries.length}</span>
                  <span aria-hidden className="h-px flex-1 bg-border/30" />
                </h3>
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
              <p className="py-2 text-xs text-muted-foreground/50">
                Nothing unscheduled.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
