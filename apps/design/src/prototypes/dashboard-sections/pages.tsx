import { itemKey } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { groupLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { ListProps } from "./board";

import { groupDay, isNow, weekday } from "./board";
import { ItemRow } from "./row";

/**
 * Day pages: each group is one sheet, a page of a day planner, with its
 * date at the head and its items as ruled lines on it. The sheet is the day,
 * not each item. Nearer pages stand out more; Late's page has a warm edge.
 * From next week on there is no page, only a heading and its lines.
 */
export function PagesList({ groups, scope }: ListProps) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {groups.map((group) => {
        const { distance } = groupLook(group);
        const late = group.tone === "late";
        const far = group.tone === "far";
        const day = groupDay(group, scope.currentDate);
        return (
          <section
            key={group.key}
            aria-label={group.label}
            className={cn(
              far ? "pt-2" : "overflow-hidden rounded-2xl border bg-card",
              !far &&
                (late
                  ? "border-condition-attention/35 bg-[color-mix(in_oklab,var(--color-condition-attention)_5%,var(--color-card))]"
                  : distance === 0
                    ? "border-border shadow-md"
                    : distance <= 2
                      ? "border-border/80"
                      : "border-border/50 bg-transparent"),
            )}
          >
            <h2
              className={cn(
                "flex items-center gap-3 px-4",
                far ? "pb-1" : "pt-3 pb-1.5",
              )}
            >
              {group.exact && (
                <span
                  className={cn(
                    "font-heading leading-none tabular-nums tracking-tight",
                    distance === 0
                      ? "text-3xl font-semibold"
                      : distance === 1
                        ? "text-2xl font-semibold text-foreground/80"
                        : "text-xl font-medium text-foreground/55",
                  )}
                >
                  {new Date(day).getDate()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span
                  className={cn(
                    "font-heading tracking-tight",
                    late
                      ? "text-lg font-semibold text-condition-attention"
                      : distance === 0
                        ? "text-base font-semibold"
                        : far
                          ? "text-sm font-medium text-muted-foreground"
                          : "text-[15px] font-medium text-foreground/85",
                  )}
                >
                  {group.label}
                </span>
                {(group.hint ??
                  (group.tone === "today"
                    ? weekday(day, "long")
                    : undefined)) && (
                  <span className="text-xs text-muted-foreground/70">
                    {group.hint ?? weekday(day, "long")}
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground/60">
                {group.items.length}
              </span>
            </h2>
            <ul
              className={cn(
                "divide-y divide-border/50",
                far ? "px-1.5" : "px-1.5 pb-1.5",
              )}
            >
              {group.items.map((item) => (
                <li key={itemKey(item)} className="py-px">
                  <ItemRow
                    item={item}
                    scope={scope}
                    dateInHeading={group.exact}
                    loud={isNow(group)}
                    quiet={far}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
