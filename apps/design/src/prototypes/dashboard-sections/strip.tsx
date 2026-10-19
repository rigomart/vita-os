import {
  itemKey,
  type BoardGroup,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { groupLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useState } from "react";

import type { ListProps } from "./board";

import { groupDay, isNow, weekday } from "./board";
import { ItemRow } from "./row";

interface Cell {
  key: string;
  /** The group it scrolls to; none for a day with nothing due. */
  target?: string;
  top: string;
  main: string;
  count: number;
  tone: "late" | "today" | "day" | "later";
}

/**
 * Week strip: the shape of the coming days as a row of cells pinned under
 * the filter: Late and Later with their counts, Today and the next six days
 * with a dot per item. An empty day stays in the strip, dimmed, so a quiet day shows.
 * Choosing a cell scrolls to its group; the group in view is marked. The
 * list under it is plain: a ruled heading per group and its items as lines.
 */
export function StripList({ groups, scope }: ListProps) {
  const active = useGroupInView(groups);
  const cells = stripCells(groups, scope.currentDate);

  return (
    <div className="flex flex-col">
      <nav
        aria-label="Days"
        className="sticky top-[4.4rem] z-[15] -mx-1 bg-surface-1/90 px-1 pt-1 pb-3 backdrop-blur-md"
      >
        <ol className="grid grid-flow-col gap-1 [grid-auto-columns:minmax(0,1fr)]">
          {cells.map((cell) => {
            const current =
              cell.target !== undefined &&
              (cell.tone === "later"
                ? active?.startsWith("week") || active?.startsWith("month")
                : active === cell.target);
            return (
              <li key={cell.key}>
                <button
                  type="button"
                  disabled={cell.target === undefined}
                  onClick={() =>
                    document
                      .getElementById(`group-${cell.target}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 rounded-xl border px-0.5 pt-1.5 pb-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    cell.tone === "today"
                      ? "border-transparent bg-primary text-primary-foreground"
                      : cell.tone === "late"
                        ? "border-condition-attention/40 bg-[color-mix(in_oklab,var(--color-condition-attention)_8%,var(--color-surface-1))] text-condition-attention"
                        : "border-border/60 bg-card hover:bg-muted/60",
                    cell.tone === "day" && cell.count === 0 && "opacity-40",
                    current &&
                      cell.tone !== "today" &&
                      "border-foreground/40 ring-1 ring-foreground/20",
                    current && cell.tone === "today" && "ring-2 ring-ring/50",
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">
                    {cell.top}
                  </span>
                  <span className="font-heading text-lg leading-none font-semibold tabular-nums">
                    {cell.main}
                  </span>
                  <Dots count={cell.count} />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-col">
        {groups.map((group) => {
          const { distance } = groupLook(group);
          const late = group.tone === "late";
          const day = groupDay(group, scope.currentDate);
          return (
            <section
              key={group.key}
              id={`group-${group.key}`}
              aria-label={group.label}
              className="scroll-mt-40 pb-3"
            >
              <h2 className="flex items-baseline gap-2.5 border-t border-border/70 px-1 pt-3 pb-1">
                {group.exact && (
                  <span
                    className={cn(
                      "font-heading tabular-nums",
                      distance === 0
                        ? "text-2xl font-semibold"
                        : "text-xl font-medium text-foreground/60",
                    )}
                  >
                    {new Date(day).getDate()}
                  </span>
                )}
                <span
                  className={cn(
                    "font-heading tracking-tight",
                    late
                      ? "text-lg font-semibold text-condition-attention"
                      : distance === 0
                        ? "text-lg font-semibold"
                        : group.tone === "far"
                          ? "text-sm font-medium text-muted-foreground"
                          : "text-base font-medium text-foreground/85",
                  )}
                >
                  {group.label}
                </span>
                {group.hint && (
                  <span className="text-xs text-muted-foreground/70">
                    {group.hint}
                  </span>
                )}
              </h2>
              <ul className="-mx-1.5">
                {group.items.map((item) => (
                  <li key={itemKey(item)}>
                    <ItemRow
                      item={item}
                      scope={scope}
                      dateInHeading={group.exact}
                      loud={isNow(group)}
                      quiet={group.tone === "far"}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Dots({ count }: { count: number }) {
  if (count > 4) {
    return <span className="h-1.5 text-[10px] leading-none">{count}</span>;
  }
  return (
    <span className="flex h-1.5 items-center gap-0.5">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="size-1 rounded-full bg-current" />
      ))}
    </span>
  );
}

function stripCells(groups: BoardGroup[], currentDate: number): Cell[] {
  const cells: Cell[] = [];
  const late = groups.find((group) => group.tone === "late");
  if (late) {
    cells.push({
      key: "late",
      target: "late",
      top: "Late",
      main: String(late.items.length),
      count: 0,
      tone: "late",
    });
  }
  for (let offset = 0; offset <= 6; offset++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    const key = offset === 0 ? "today" : `day-${offset}`;
    const group = groups.find((candidate) => candidate.key === key);
    cells.push({
      key,
      target: group?.key,
      top: offset === 0 ? "Today" : weekday(date.getTime(), "short"),
      main: String(date.getDate()),
      count: group?.items.length ?? 0,
      tone: offset === 0 ? "today" : "day",
    });
  }
  const far = groups.filter((group) => group.tone === "far");
  if (far.length > 0) {
    cells.push({
      key: "later",
      target: far[0]!.key,
      top: "Later",
      main: String(far.reduce((sum, group) => sum + group.items.length, 0)),
      count: 0,
      tone: "later",
    });
  }
  return cells;
}

/** The key of the group nearest the top of the screen, under the strip. */
function useGroupInView(groups: BoardGroup[]) {
  const [active, setActive] = useState<string | undefined>(groups[0]?.key);
  const keys = groups.map((group) => group.key).join(",");
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.id.replace(/^group-/, "");
          if (entry.isIntersecting)
            visible.set(key, entry.boundingClientRect.top);
          else visible.delete(key);
        }
        const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (first) setActive(first[0]);
      },
      { rootMargin: "-160px 0px -50% 0px" },
    );
    for (const key of keys.split(",")) {
      const element = document.getElementById(`group-${key}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [keys]);
  return active;
}
