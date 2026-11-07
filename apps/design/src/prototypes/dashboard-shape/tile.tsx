import type { BoardItem } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";

import { Link } from "@tanstack/react-router";
import { DashboardLine } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import {
  itemTitle,
  lookAt,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

/**
 * One item as a card: the product's own line, with its Complete and date
 * controls, set on a sheet. `late` gives the sheet the attention colour,
 * the only colour on the board.
 */
export function ItemCard({
  item,
  scope,
  distance,
  late,
  className,
}: {
  item: BoardItem;
  scope: BoardScope;
  distance: number;
  late: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl bg-surface-2 px-2.5 py-1 ring-1 ring-border/60",
        late &&
          "bg-[color-mix(in_oklab,var(--condition-attention)_12%,var(--color-surface-2))] ring-condition-attention/45",
        className,
      )}
    >
      <DashboardLine
        dateInHeading={false}
        item={item}
        look={lookAt(distance).line}
        scope={scope}
      />
    </div>
  );
}

/**
 * An item too small for its line: the Thread's title (its Task in the
 * tooltip) or the Note's first line, opening it, nothing else.
 */
export function ItemChip({
  item,
  scope,
  late,
  className,
}: {
  item: BoardItem;
  scope: BoardScope;
  late: boolean;
  className?: string;
}) {
  const title = itemTitle(item);
  const look = cn(
    "block size-full truncate rounded-md bg-surface-2 px-1.5 py-1 text-left text-[11px] leading-tight text-foreground/70 ring-1 ring-border/50 outline-none hover:text-foreground focus-visible:ring-ring",
    late &&
      "bg-[color-mix(in_oklab,var(--condition-attention)_12%,var(--color-surface-2))] ring-condition-attention/45",
    className,
  );
  if (item.kind === "note") {
    return (
      <button
        type="button"
        title={title}
        className={look}
        onClick={() => scope.onOpenNote(item.note)}
      >
        {title}
      </button>
    );
  }
  return (
    <Link
      to="."
      title={item.task ? `${item.task.text} · ${title}` : title}
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        thread: item.thread.slug,
      })}
      className={look}
    >
      {title}
    </Link>
  );
}
