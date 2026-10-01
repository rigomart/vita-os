import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { cn } from "@vita-os/ui/lib/utils";
import { addDays, format } from "date-fns";

import type { BoardItem } from "./attention-board-model";

import { itemId } from "./attention-board-model";
import { dateToken, startOfLocalDay } from "./dashboard-model";
import { buildHorizon } from "./later-horizon-model";

/**
 * The folded Later lane's scale: banded like the open column's groups, with a
 * short mark per item — solid for a Thread, outlined for a Note, the soonest
 * in the accent. Hovering a mark names it.
 *
 * It sits inside the lane's fold trigger, so it is decoration to assistive
 * technology: the trigger already says how many items wait and when the next
 * one arrives, and unfolding lists them all.
 */
export function LaterHorizon({
  currentDate,
  items,
}: {
  currentDate: number;
  items: BoardItem[];
}) {
  const { bands, beyond, end, marks } = buildHorizon(items, currentDate);
  const percent = (fraction: number) => `${fraction * 100}%`;

  return (
    <span aria-hidden className="flex min-h-0 flex-1 flex-col">
      <span className="relative mx-2 mt-3 mb-2 block flex-1">
        {bands.map((band, index) => (
          <span
            key={band.key}
            className={cn(
              "absolute inset-x-0 rounded-[5px]",
              index % 2 === 0 && "bg-muted/55",
            )}
            style={{
              top: percent(band.from),
              height: `calc(${percent(band.to - band.from)} - 2px)`,
            }}
          >
            {band.label && (
              <span className="absolute top-1 left-1.5 text-[9.5px] leading-none text-muted-foreground/80 tabular-nums">
                {band.label}
              </span>
            )}
          </span>
        ))}

        {marks.map((mark) => (
          // A taller hit area than the bar it draws, so a mark is easy to hover.
          <span
            key={itemId(mark.item)}
            data-label={`${itemTitle(mark.item)} · ${dateToken(mark.item.when ?? currentDate, currentDate)}`}
            className="group/mark absolute right-1.5 z-10 flex h-2 -translate-y-1/2 items-center after:pointer-events-none after:absolute after:top-1/2 after:right-[calc(100%+0.5rem)] after:z-30 after:-translate-y-1/2 after:rounded-md after:border after:bg-popover after:px-2 after:py-0.5 after:text-[11px] after:whitespace-nowrap after:text-popover-foreground after:opacity-0 after:shadow-md after:transition-opacity after:content-[attr(data-label)] hover:after:opacity-100"
            style={{
              top: percent(mark.at),
              width: `calc((1.75rem - ${mark.of - 1} * 2px) / ${mark.of})`,
              marginRight: `calc(${mark.slot} * ((1.75rem - ${mark.of - 1} * 2px) / ${mark.of} + 2px))`,
            }}
          >
            <span
              className={cn(
                "h-1 w-full rounded-full transition-colors",
                mark.next
                  ? "bg-brand-accent-strong"
                  : mark.item.kind === "note"
                    ? "h-[5px] border border-foreground/50 group-hover/mark:border-brand-accent"
                    : "bg-foreground/55 group-hover/mark:bg-brand-accent",
              )}
            />
          </span>
        ))}
      </span>

      {beyond > 0 && (
        <span
          title={`${beyond} more after ${format(addDays(startOfLocalDay(currentDate), end - 1), "MMM d")}`}
          className="px-2 pb-2 text-[10.5px] text-muted-foreground tabular-nums"
        >
          +{beyond} later
        </span>
      )}
    </span>
  );
}

function itemTitle(item: BoardItem) {
  if (item.kind === "thread") return item.thread.title;
  const text = markdownToPlainText(item.note.body).replaceAll(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}
