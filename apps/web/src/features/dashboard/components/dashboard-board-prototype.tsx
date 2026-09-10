/**
 * PROTOTYPE — throwaway. Delete with the rest of this branch.
 *
 * Question: what should the *chrome around* the board be? The cards and notes
 * inside are settled; what is unsettled is how the columns are separated
 * (border? elevation? one container? nothing?) and how the "No date" margin
 * reads next to them.
 *
 * Four chromes of the same board, on the real `/` route, switchable via
 * `?chrome=A|B|C|D` and the floating bar at the bottom.
 *
 *   A — Borders (today)   each column is its own outlined box
 *   B — Elevation         columns float as raised panels; the margin recesses
 *   C — One slab          a single container, columns divided by hairlines
 *   D — Air               no boxes at all; rules and whitespace only
 */
import type { ProjectedArea } from "@convex/lib/validators";

import { cn } from "@/lib/utils";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { itemId, unscheduledCount } from "./attention-board-model";
import { AttentionCard } from "./attention-card";
import { DashboardNote } from "./dashboard-note";

export const CHROMES = ["A", "B", "C", "D"] as const;
export type Chrome = (typeof CHROMES)[number];

export const CHROME_NAMES: Record<Chrome, string> = {
  A: "Borders (today)",
  B: "Elevation",
  C: "One slab",
  D: "Air",
};

interface BoardProps {
  areas: ProjectedArea[];
  board: AttentionBoard;
  currentDate: number;
}

interface Column {
  key: string;
  title: string;
  hint: string;
  urgent?: boolean;
  items: BoardItem[];
}

interface Run {
  key: string;
  title: string;
  items: BoardItem[];
}

/** Column + run data and the item renderer. Identical across chromes. */
function useBoardParts({ areas, board, currentDate }: BoardProps) {
  const areaById = new Map(areas.map((area) => [area._id, area]));

  const columns: Column[] = [
    {
      key: "now",
      title: "Now",
      hint: "Late or due today",
      urgent: true,
      items: board.now,
    },
    {
      key: "week",
      title: "This week",
      hint: "The next six days",
      items: board.week,
    },
    {
      key: "later",
      title: "Later",
      hint: "Dated beyond this week",
      items: board.later,
    },
  ];

  const runs: Run[] = [
    { key: "moves", title: "Ready to move", items: board.unscheduled.moves },
    { key: "open", title: "Open", items: board.unscheduled.open },
    { key: "notes", title: "Notes", items: board.unscheduled.notes },
  ].filter((run) => run.items.length > 0);

  const renderItem = (item: BoardItem) =>
    item.kind === "note" ? (
      <DashboardNote currentDate={currentDate} note={item.note} />
    ) : (
      <AttentionCard
        area={areaById.get(item.thread.areaId)}
        currentDate={currentDate}
        thread={item.thread}
      />
    );

  return { columns, runs, renderItem, unscheduled: unscheduledCount(board) };
}

function Items({
  className,
  items,
  renderItem,
}: {
  className?: string;
  items: BoardItem[];
  renderItem: (item: BoardItem) => React.ReactNode;
}) {
  return (
    <ul
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto",
        className,
      )}
    >
      {items.map((item) => (
        <li key={itemId(item)}>{renderItem(item)}</li>
      ))}
      {items.length === 0 && (
        <li className="px-1 py-2 text-xs text-muted-foreground/50">
          Nothing here.
        </li>
      )}
    </ul>
  );
}

function Runs({
  labelClassName = "text-muted-foreground/45",
  renderItem,
  ruleClassName = "bg-border/30",
  runs,
}: {
  labelClassName?: string;
  renderItem: (item: BoardItem) => React.ReactNode;
  ruleClassName?: string;
  runs: Run[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
      {runs.map((run) => (
        <section key={run.key}>
          <h3
            className={cn(
              "flex items-center gap-1.5 pb-1 text-[10px] font-medium tracking-wider uppercase",
              labelClassName,
            )}
          >
            {run.title}
            <span className="tabular-nums">{run.items.length}</span>
            <span aria-hidden className={cn("h-px flex-1", ruleClassName)} />
          </h3>
          <ul className="flex flex-col gap-1">
            {run.items.map((item) => (
              <li key={itemId(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        </section>
      ))}
      {runs.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground/50">
          Nothing unscheduled.
        </p>
      )}
    </div>
  );
}

/* ─── A — Borders (today) ─────────────────────────────────────────────────
 * Four outlined boxes in a row, the margin fenced off behind a rule.
 */

export function ChromeA(props: BoardProps) {
  const { columns, renderItem, runs, unscheduled } = useBoardParts(props);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <section
            key={column.key}
            aria-label={column.title}
            className={cn(
              "flex min-h-0 flex-col rounded-xl border",
              column.urgent
                ? "border-condition-attention/35 bg-surface-2"
                : "border-border/50",
            )}
          >
            <header className="flex items-baseline gap-2 px-2.5 pt-2 pb-1.5">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {column.items.length}
              </span>
              <span
                title={column.hint}
                aria-hidden
                className="h-px flex-1 bg-border/40"
              />
            </header>
            <Items
              className="px-1.5 pb-2"
              items={column.items}
              renderItem={renderItem}
            />
          </section>
        ))}
      </div>

      <aside
        aria-label="No date"
        className="flex min-h-0 flex-col xl:w-68 xl:shrink-0 xl:border-l xl:border-border/60 xl:pl-4"
      >
        <header className="flex items-baseline gap-2 border-t border-border/60 pt-2 pb-1.5 xl:border-t-0 xl:pt-0">
          <h2 className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            No date
          </h2>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {unscheduled}
          </span>
        </header>
        <Runs renderItem={renderItem} runs={runs} />
      </aside>
    </div>
  );
}

/* ─── B — Elevation ───────────────────────────────────────────────────────
 * No outlines anywhere. The three dated columns are raised panels lifted off
 * the page ground by tone and a soft shadow; **Now** is lifted highest and
 * carries a coloured cap rather than a coloured outline. The margin does the
 * opposite — it sinks into the ground as a recessed well, so "no date" reads
 * as *below* the board rather than as a fourth step after Later.
 */

export function ChromeB(props: BoardProps) {
  const { columns, renderItem, runs, unscheduled } = useBoardParts(props);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:gap-5">
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <section
            key={column.key}
            aria-label={column.title}
            className={cn(
              "relative flex min-h-0 flex-col overflow-hidden rounded-xl bg-surface-2",
              column.urgent
                ? "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_16px_-6px_rgba(0,0,0,0.18)]"
                : "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_3px_10px_-6px_rgba(0,0,0,0.12)]",
            )}
          >
            {column.urgent && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5 bg-condition-attention/70"
              />
            )}
            <header className="flex items-baseline gap-2 px-3 pt-2.5 pb-2">
              <h2
                className={cn(
                  "text-sm font-semibold",
                  column.urgent && "text-condition-attention",
                )}
              >
                {column.title}
              </h2>
              <span
                title={column.hint}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {column.items.length}
              </span>
            </header>
            <Items
              className="px-2 pb-2.5"
              items={column.items}
              renderItem={renderItem}
            />
          </section>
        ))}
      </div>

      <aside
        aria-label="No date"
        className="flex min-h-0 flex-col rounded-xl bg-surface-1 px-3 pt-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.09)] xl:w-68 xl:shrink-0"
      >
        <header className="flex items-baseline gap-2 pb-1.5">
          <h2 className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            No date
          </h2>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {unscheduled}
          </span>
        </header>
        <Runs renderItem={renderItem} runs={runs} />
      </aside>
    </div>
  );
}

/* ─── C — One slab ────────────────────────────────────────────────────────
 * One container for the whole board instead of four. The chrome is drawn once
 * — a single rounded, bordered slab — and the columns are only hairlines
 * inside it, like a table. A sticky header band runs the full width so the
 * column titles read as one row of headings; the margin is the last cell of
 * that same table, tinted down and behind a heavier divider, so it is
 * visibly part of the board without being another step in time.
 */

export function ChromeC(props: BoardProps) {
  const { columns, renderItem, runs, unscheduled } = useBoardParts(props);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-surface-2 xl:flex-row">
      <div className="grid min-h-0 flex-1 xl:grid-cols-3">
        {columns.map((column, index) => (
          <section
            key={column.key}
            aria-label={column.title}
            className={cn(
              "flex min-h-0 flex-col",
              index > 0 && "xl:border-l xl:border-border/40",
            )}
          >
            <header className="flex items-baseline gap-2 border-b border-border/40 px-3 py-2">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <span
                title={column.hint}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {column.items.length}
              </span>
              {column.urgent && (
                <span
                  aria-hidden
                  className="ml-auto size-1.5 rounded-full bg-condition-attention/80"
                />
              )}
            </header>
            <Items
              className="px-2 py-2"
              items={column.items}
              renderItem={renderItem}
            />
          </section>
        ))}
      </div>

      <aside
        aria-label="No date"
        className="flex min-h-0 flex-col bg-surface-1/60 xl:w-68 xl:shrink-0 xl:border-l-2 xl:border-border/60"
      >
        <header className="flex items-baseline gap-2 border-b border-border/40 px-3 py-2">
          <h2 className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            No date
          </h2>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {unscheduled}
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-2">
          <Runs renderItem={renderItem} runs={runs} />
        </div>
      </aside>
    </div>
  );
}

/* ─── D — Air ─────────────────────────────────────────────────────────────
 * No boxes at all. Separation is whitespace plus one heavy rule under each
 * column heading — the only place colour appears, on **Now**. Wide gutters do
 * the work the borders were doing; the cards' own hover states become the
 * board's only edges. The margin gets no rule and no line beside it: it is
 * simply set further out, quieter, and labelled.
 */

export function ChromeD(props: BoardProps) {
  const { columns, renderItem, runs, unscheduled } = useBoardParts(props);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 xl:flex-row xl:gap-10">
      <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        {columns.map((column) => (
          <section
            key={column.key}
            aria-label={column.title}
            className="flex min-h-0 flex-col"
          >
            <header
              className={cn(
                "mb-1.5 flex items-baseline gap-2 border-b-2 pb-1.5",
                column.urgent
                  ? "border-condition-attention/60"
                  : "border-border/70",
              )}
            >
              <h2
                className={cn(
                  "text-[11px] font-semibold tracking-widest uppercase",
                  column.urgent
                    ? "text-condition-attention"
                    : "text-foreground/70",
                )}
              >
                {column.title}
              </h2>
              <span
                title={column.hint}
                className="text-[11px] tabular-nums text-muted-foreground/60"
              >
                {column.items.length}
              </span>
            </header>
            <Items
              className="-mx-1 px-1"
              items={column.items}
              renderItem={renderItem}
            />
          </section>
        ))}
      </div>

      <aside
        aria-label="No date"
        className="flex min-h-0 flex-col opacity-90 xl:w-64 xl:shrink-0"
      >
        <header className="mb-1.5 flex items-baseline gap-2 pb-1.5">
          <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
            No date
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/40">
            {unscheduled}
          </span>
        </header>
        <Runs
          labelClassName="text-muted-foreground/40"
          renderItem={renderItem}
          ruleClassName="bg-transparent"
          runs={runs}
        />
      </aside>
    </div>
  );
}

export const CHROME_COMPONENTS: Record<
  Chrome,
  (props: BoardProps) => React.ReactNode
> = {
  A: ChromeA,
  B: ChromeB,
  C: ChromeC,
  D: ChromeD,
};
