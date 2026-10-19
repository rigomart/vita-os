import {
  itemKey,
  type BoardGroup,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { groupLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { dayDelta } from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { ListProps } from "./board";

import { groupDay, isNow } from "./board";
import { ItemRow } from "./row";

/**
 * Timeline: time is a line down the left, and each group hangs off a stop on
 * it. Late's stretch of the line is warm; Today's stop is the largest. Near
 * items are small sheets threaded on the line, far ones plain lines, and the
 * line turns dashed where the days give way to weeks. Groups stand further
 * apart the more days lie between them, so a quiet stretch shows as space.
 */
export function TimelineList({ groups, scope }: ListProps) {
  return (
    <ol className="relative pt-3 pb-6">
      {groups.map((group, index) => {
        const previous = groups[index - 1];
        const gap =
          previous === undefined
            ? 0
            : Math.min(
                Math.max(
                  dayDelta(
                    groupDay(group, scope.currentDate),
                    groupDay(previous, scope.currentDate),
                  ) - 1,
                  0,
                ),
                4,
              );
        return (
          <TimelineStop
            key={group.key}
            group={group}
            last={index === groups.length - 1}
            gap={gap}
            scope={scope}
          />
        );
      })}
    </ol>
  );
}

function TimelineStop({
  gap,
  group,
  last,
  scope,
}: {
  gap: number;
  group: BoardGroup;
  last: boolean;
  scope: ListProps["scope"];
}) {
  const { distance } = groupLook(group);
  const late = group.tone === "late";
  const today = group.tone === "today";
  const far = group.tone === "far";
  return (
    <li
      aria-label={group.label}
      className="relative pl-9"
      style={{ paddingTop: 4 + gap * 10 }}
    >
      {/* The line, from this stop down to the next. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 left-[11px] w-0 border-l-2",
          last ? "h-8" : "bottom-0",
          late
            ? "border-condition-attention/60"
            : far
              ? "border-dashed border-border"
              : "border-border",
        )}
      />
      <h2
        className="relative flex items-baseline gap-2 pb-1.5"
        style={{ minHeight: 28 }}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "left-[-24px]",
            late
              ? "size-3 bg-condition-attention ring-4 ring-surface-1"
              : today
                ? "size-4 bg-foreground ring-4 ring-surface-1"
                : far
                  ? "size-2 border-2 border-muted-foreground/50 bg-surface-1"
                  : "size-2.5 border-2 border-foreground/60 bg-surface-1",
          )}
        />
        <span
          className={cn(
            "font-heading tracking-tight",
            late
              ? "text-lg font-semibold text-condition-attention"
              : today
                ? "text-xl font-semibold"
                : distance <= 1
                  ? "text-base font-semibold"
                  : distance <= 3
                    ? "text-[15px] font-medium text-foreground/85"
                    : "text-sm font-medium text-muted-foreground",
          )}
        >
          {group.label}
        </span>
        {group.hint && (
          <span className="text-xs text-muted-foreground/70">{group.hint}</span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground/50">
          {group.items.length}
        </span>
      </h2>
      <ul
        className={cn(
          "flex flex-col pb-4",
          far ? "-ml-2.5 gap-0" : "gap-1.5 @2xl:grid @2xl:grid-cols-2",
        )}
      >
        {group.items.map((item) => (
          <li
            key={itemKey(item)}
            className={cn(
              !far &&
                "rounded-xl border bg-card [&_[data-slot=thread-copy]]:rounded-xl",
              !far &&
                (late
                  ? "border-condition-attention/30"
                  : today
                    ? "border-border"
                    : "border-border/60"),
            )}
          >
            <ItemRow
              item={item}
              scope={scope}
              dateInHeading={group.exact}
              loud={isNow(group)}
              quiet={far}
              stacked={!far}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}
