import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314. E1: "Time columns" — the settled layout.
 *
 * Four full-height columns (Now · This week · Later · Resting) of cards under
 * the header. Each column owns its own scroll, so a busy column never pushes
 * the others down and an empty one never leaves a hole.
 *
 * Round 8 adds the open question: where standalone **Notes** go. They are no
 * longer Thread cards with a dashed glyph — they are drawn as paper, in the
 * app's own Note grammar — and `noteMode` decides where that paper lives:
 *
 *   "column" — Notes leave time entirely and get a column of their own.
 *   "mixed"  — dated Notes sit under their date; undated ones fall into a tray
 *              at the foot of Now.
 *   "hybrid" — dated Notes stay under their date, and only the undated ones
 *              get a column.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";

export type NoteMode = "column" | "hybrid" | "mixed";

export function VariantE1TimeColumns({
  areas,
  currentDate,
  header,
  noteMode,
  notes,
  renderCard,
  renderNote,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  /** The header band, rendered above the columns. */
  header: (entries: PrototypeEntry[]) => React.ReactNode;
  /** Where standalone Notes live — the question this round asks. */
  noteMode: NoteMode;
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

  // Which Notes are allowed to sit in a time column at all.
  const timedNotes =
    noteMode === "column"
      ? []
      : noteEntries.filter((entry) => entry.when !== undefined);
  const asideNotes =
    noteMode === "column"
      ? noteEntries
      : noteEntries.filter((entry) => entry.when === undefined);

  const timed = [...threadEntries, ...timedNotes];

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: "Late, due today, or ready to move",
      urgent: true,
      entries: timed
        .filter((entry) => {
          const d = delta(entry);
          return d !== undefined ? d <= 0 : entry.isNextMove;
        })
        .sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity)),
    },
    {
      key: "week",
      title: "This week",
      hint: "The next six days",
      entries: timed
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
      entries: timed
        .filter((entry) => (delta(entry) ?? 0) > 6)
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      key: "resting",
      title: "Resting",
      hint: "Open, undated, no move captured",
      entries: threadEntries.filter(
        (entry) => entry.when === undefined && !entry.isNextMove,
      ),
    },
  ];

  const notesColumn = noteMode !== "mixed" && asideNotes.length > 0;

  return (
    <div className="flex h-[calc(100svh-10rem)] min-h-[34rem] flex-col gap-3">
      {header(allEntries)}

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 md:grid-cols-2",
          notesColumn
            ? "xl:grid-cols-[repeat(4,minmax(0,1fr))_19rem]"
            : "xl:grid-cols-4",
        )}
      >
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

            {/* "mixed" has nowhere else to put an undated Note, so Now grows a
                tray for them rather than losing them off the board. */}
            {noteMode === "mixed" &&
              column.key === "now" &&
              asideNotes.length > 0 && (
                <div className="border-t border-border/50 px-1.5 pb-2 pt-1.5">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Notes, no date
                    <span className="ml-1.5 tabular-nums opacity-70">
                      {asideNotes.length}
                    </span>
                  </p>
                  <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
                    {asideNotes.map((entry) => (
                      <li key={entry.id}>{renderNote(entry)}</li>
                    ))}
                  </ul>
                </div>
              )}
          </section>
        ))}

        {notesColumn && (
          <section className="flex min-h-0 flex-col rounded-xl border border-dashed border-border/60">
            <header className="flex items-baseline gap-2 px-2.5 pb-1.5 pt-2">
              <h2 className="text-sm font-semibold">Notes</h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {asideNotes.length}
              </span>
              <span
                title={
                  noteMode === "column"
                    ? "Every standalone Note, dated or not"
                    : "Standalone Notes with no attention date"
                }
                aria-hidden
                className="h-px flex-1 bg-border/40"
              />
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2">
              {[...asideNotes]
                .sort((a, b) => (a.when ?? Infinity) - (b.when ?? Infinity))
                .map((entry) => (
                  <li key={entry.id}>{renderNote(entry)}</li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
