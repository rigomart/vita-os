import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314. E1: "Time columns" — the settled layout.
 *
 * Four full-height columns (Now · This week · Later · Resting) of cards under
 * the stat strip. Each column owns its own scroll, so a busy column never
 * pushes the others down and an empty one never leaves a hole — that is what
 * fixed round 3's dead space at the bottom of the page.
 *
 * The card is now a parameter: the layout is decided, and what is under test
 * is how the Thread title stays present now that the Next Move leads. See
 * `attention-card.tsx`.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";
import type { CardTreatment } from "./attention-card";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";

export const variantE1Name = "Time columns";

export function VariantE1TimeColumns({
  areas,
  card,
  currentDate,
  header,
  notes,
  threads,
}: {
  areas: DashboardArea[];
  /** The card treatment under test; the layout is settled. */
  card: CardTreatment;
  currentDate: number;
  /** The header band under test, rendered above the columns. */
  header: (entries: PrototypeEntry[]) => React.ReactNode;
  notes: DashboardInboxNote[];
  threads: DashboardThread[];
}) {
  const { Card } = card;
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ];

  const delta = (entry: PrototypeEntry) =>
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: "Late, due today, or ready to move",
      urgent: true,
      entries: entries
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
      entries: entries
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
      entries: entries
        .filter((entry) => (delta(entry) ?? 0) > 6)
        .sort((a, b) => (a.when ?? 0) - (b.when ?? 0)),
    },
    {
      key: "resting",
      title: "Resting",
      hint: "Open, undated, no move captured",
      entries: entries.filter(
        (entry) =>
          entry.kind === "thread" &&
          entry.when === undefined &&
          !entry.isNextMove,
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100svh-10rem)] min-h-[34rem] flex-col gap-3">
      {header(entries)}

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
            {/* Each column scrolls itself: no column can leave a hole. */}
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-2">
              {column.entries.map((entry) => (
                <li key={entry.id}>
                  <Card currentDate={currentDate} entry={entry} />
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
    </div>
  );
}
