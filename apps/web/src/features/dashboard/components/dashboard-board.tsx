import type { ProjectedArea } from "@convex/lib/validators";

import { cn } from "@/lib/utils";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { itemId, unscheduledCount } from "./attention-board-model";
import { AttentionCard } from "./attention-card";
import { DashboardNote } from "./dashboard-note";

/**
 * The board: three columns of dates and a margin for everything else.
 *
 * Each column scrolls itself and the board fills the viewport, so a busy
 * column never pushes the others down and a quiet one never leaves a hole at
 * the foot of the page.
 *
 * **No date** is deliberately not a fourth column. It is not a time bucket, so
 * drawing it as another panel in the row made it read as the step after
 * "Later"; it sits outside the group behind a rule instead, with its own seams
 * admitted as labelled runs — what you could do now, what is merely open, and
 * the Notes.
 */
export function DashboardBoard({
  areas,
  board,
  currentDate,
}: {
  areas: ProjectedArea[];
  board: AttentionBoard;
  currentDate: number;
}) {
  const areaById = new Map(areas.map((area) => [area._id, area]));

  const columns = [
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

  const runs = [
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

            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5 pb-2">
              {column.items.map((item) => (
                <li key={itemId(item)}>{renderItem(item)}</li>
              ))}
              {column.items.length === 0 && (
                <li className="px-1 py-2 text-xs text-muted-foreground/50">
                  Nothing here.
                </li>
              )}
            </ul>
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
            {unscheduledCount(board)}
          </span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
          {runs.map((run) => (
            <section key={run.key}>
              <h3 className="flex items-center gap-1.5 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground/45 uppercase">
                {run.title}
                <span className="tabular-nums">{run.items.length}</span>
                <span aria-hidden className="h-px flex-1 bg-border/30" />
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
      </aside>
    </div>
  );
}
