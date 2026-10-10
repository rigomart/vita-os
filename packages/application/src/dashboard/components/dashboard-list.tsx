import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { cn } from "@vita-os/ui/lib/utils";

import type { ProductSearch } from "../../navigation/search-params";
import type { AttentionBoard, BoardItem } from "./attention-board-model";
import type { BoardScope } from "./dashboard-item";

import { groupByWhen, itemId } from "./attention-board-model";
import { DashboardItem } from "./dashboard-item";
import { groupLook, itemTitle } from "./dashboard-list-model";
import { dateToken } from "./dashboard-model";

/**
 * Every dated item in one list, what is asking first: Late, Today, then each
 * day of the week, then weeks and months. Each group is a file tab, filled
 * more the nearer it is. From next week on an item is a single line, since it
 * is only there to be known about. When the list is wide enough, cards sit
 * two to a row.
 */
export function DashboardList({
  board,
  scope,
}: {
  board: AttentionBoard;
  scope: BoardScope;
}) {
  const groups = groupByWhen(
    [...board.now, ...board.week, ...board.later],
    scope.currentDate,
  );

  if (groups.length === 0) {
    return (
      <p className="pt-2 text-[15px] text-muted-foreground">
        Nothing is on the calendar.
      </p>
    );
  }

  return (
    <div className="@container flex flex-col gap-4 pt-2">
      {groups.map((group) => {
        const look = groupLook(group);
        return (
          <FileTab
            key={group.key}
            label={group.label}
            fill={look.fill}
            heading={
              <>
                <span
                  className={cn("font-heading tracking-tight", look.heading)}
                >
                  {group.label}
                </span>
                {group.hint && (
                  <span className="text-[13px] text-muted-foreground">
                    {group.hint}
                  </span>
                )}
                <Count count={group.items.length} />
              </>
            }
          >
            {look.oneLine ? (
              <Lines items={group.items} scope={scope} />
            ) : (
              <ul className="grid gap-x-1 @2xl:grid-cols-2">
                {group.items.map((item) => (
                  <li key={itemId(item)}>
                    <DashboardItem
                      dateInHeading={group.exact}
                      item={item}
                      onLateFill={group.tone === "late"}
                      scope={scope}
                    />
                  </li>
                ))}
              </ul>
            )}
          </FileTab>
        );
      })}
    </div>
  );
}

/**
 * A group as one shape, like a file tab on its folder: the heading on a tab,
 * the items on the fill below, and the corner where they meet turned inward.
 */
export function FileTab({
  children,
  fill,
  heading,
  label,
}: {
  children: ReactNode;
  fill: string;
  heading: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label}>
      <div className="flex">
        <div className={cn("relative rounded-t-xl", fill)}>
          <h2 className="flex items-baseline gap-2.5 px-4 pt-2 pb-1">
            {heading}
          </h2>
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0 left-full size-3 [mask-image:radial-gradient(circle_at_100%_0,transparent_11.5px,black_12px)]",
              fill,
            )}
          />
        </div>
      </div>
      <div className={cn("rounded-2xl rounded-tl-none p-1.5", fill)}>
        {children}
      </div>
    </section>
  );
}

export function Count({ count }: { count: number }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground/60">
      {count}
    </span>
  );
}

/**
 * Far enough away to be a line each: a dot (solid for a Thread, outlined for
 * a Note), what it is, and when. The whole line opens it.
 */
function Lines({ items, scope }: { items: BoardItem[]; scope: BoardScope }) {
  return (
    <ul className="grid gap-x-1 @2xl:grid-cols-2">
      {items.map((item) => {
        const content = (
          <>
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 -translate-y-px rounded-full",
                item.kind === "note"
                  ? "border border-muted-foreground"
                  : "bg-muted-foreground/70",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{itemTitle(item)}</span>
            {item.when !== undefined && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {dateToken(item.when, scope.currentDate)}
              </span>
            )}
          </>
        );
        return (
          <li key={itemId(item)}>
            {item.kind === "thread" ? (
              <Link
                to="."
                search={(previous: ProductSearch): ProductSearch => ({
                  ...previous,
                  thread: item.thread.slug,
                })}
                className={lineClassName}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                aria-label={`Open note: ${markdownToPlainText(item.note.body).slice(0, 120)}`}
                onClick={() => scope.onOpenNote(item.note)}
                className={lineClassName}
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const lineClassName =
  "flex w-full items-baseline gap-3 rounded-lg px-3 py-1.5 text-left text-sm text-foreground/80 transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40";
