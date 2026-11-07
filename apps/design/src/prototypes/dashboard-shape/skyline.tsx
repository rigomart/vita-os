import type { BoardItem } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";

import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { BodyProps } from "./board";

import { Count, SpanLabel } from "./board";
import { ItemChip } from "./tile";

/**
 * The board as a skyline under the sky: one column per day that has
 * something, Late and Today first, then each day of the week, then Later
 * and No date. Each item is a block stacked up from a shared ground line,
 * so a column's height is its count and the week's shape is one glance.
 * Near columns are wider. The direction I would not have proposed: it is
 * the closest of these to a calendar.
 */
export function Skyline({ bands, board, scope }: BodyProps) {
  const now = groupByWhen(board.now, scope.currentDate);
  const days = groupByWhen(board.week, scope.currentDate);
  const later = bands.find((band) => band.key === "later")!;
  const none = bands.find((band) => band.key === "none")!;
  const columns: Column[] = [
    ...now.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items,
      late: group.tone === "late",
      width: "w-48",
    })),
    ...days.map((group) => ({
      key: group.key,
      label: group.label,
      hint: group.hint,
      items: group.items,
      late: false,
      width: group.tone === "near" ? "w-32" : "w-28",
    })),
    {
      key: "later",
      label: "Later",
      items: later.items,
      late: false,
      width: "w-28",
    },
    {
      key: "none",
      label: "No date",
      items: none.items,
      late: false,
      width: "w-28",
    },
  ];

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max items-end gap-2 border-b-2 border-border/80 px-1">
        {columns.map((column, index) => (
          <section
            key={column.key}
            aria-label={column.label}
            className={cn(
              "flex flex-col-reverse gap-1 pb-1.5",
              column.width,
              column.key === "later" && "ml-4",
              index > 1 && "opacity-90",
            )}
          >
            {column.items.map((item) => (
              <div key={itemKey(item)} className="h-8">
                <ItemChip
                  item={item}
                  scope={scope}
                  late={column.late}
                  className="text-xs"
                />
              </div>
            ))}
            <h2 className="flex flex-wrap items-baseline gap-x-1.5 px-1 pb-1">
              <Count
                count={column.items.length}
                className={index < now.length ? "text-3xl" : "text-xl"}
              />
              <SpanLabel
                label={column.label}
                late={column.late}
                className={index < now.length ? "text-base" : "text-sm"}
              />
              {column.hint && (
                <span className="w-full text-[11px] text-muted-foreground">
                  {column.hint}
                </span>
              )}
            </h2>
          </section>
        ))}
      </div>
    </div>
  );
}

interface Column {
  key: string;
  label: string;
  hint?: string;
  items: BoardItem[];
  late: boolean;
  width: string;
}
