import type { ProjectedArea } from "@convex/lib/validators";

import { ConnectedThreadAttentionCard } from "@/features/threads/components/thread-attention-card";
import { cn } from "@/lib/utils";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { itemId, unscheduledCount } from "./attention-board-model";
import { DashboardNote } from "./dashboard-note";

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
      <ConnectedThreadAttentionCard
        area={areaById.get(item.thread.areaId)}
        currentDate={currentDate}
        thread={item.thread}
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:gap-8">
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

            <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
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
        className="flex min-h-0 flex-col border-t border-border/50 pt-4 xl:w-64 xl:shrink-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5"
      >
        <header className="mb-1.5 flex items-baseline gap-2 border-b-2 border-transparent pb-1.5">
          <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            No date
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {unscheduledCount(board)}
          </span>
        </header>

        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
          {runs.map((run) => (
            <section key={run.key}>
              <h3 className="flex items-baseline gap-1.5 pb-1 text-[11px] leading-snug font-medium text-muted-foreground/70">
                {run.title}
                <span className="tabular-nums text-muted-foreground/45">
                  {run.items.length}
                </span>
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
