import { itemKey } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { groupLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { ListProps } from "./board";

import { groupDay } from "./board";
import { ItemRow } from "./row";

/**
 * Week strip's plain list, without the strip, graded by attention: every
 * group is a ruled heading over lines, and the nearer it is the larger,
 * bolder and darker both read, with more room around them. Late and Today
 * lead; the months at the end are small and faint until hovered.
 */
export function GradedList({ groups, scope }: ListProps) {
  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const level = groupLook(group).distance;
        const late = group.tone === "late";
        const look = headingLooks[level]!;
        return (
          <section
            key={group.key}
            aria-label={group.label}
            className={look.section}
          >
            <h2
              className={cn(
                "flex items-baseline gap-2.5 border-t px-1",
                look.rule,
              )}
            >
              {group.exact && (
                <span className={cn("font-heading tabular-nums", look.numeral)}>
                  {new Date(groupDay(group, scope.currentDate)).getDate()}
                </span>
              )}
              <span
                className={cn(
                  "font-heading tracking-tight",
                  look.label,
                  late && "text-condition-attention",
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
                    level={level}
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

/** Each distance's heading and room, from Late and Today out to the months. */
const headingLooks = [
  {
    section: "pb-5",
    rule: "border-border/80 pt-4 pb-1.5",
    numeral: "text-3xl font-semibold",
    label: "text-xl font-semibold",
  },
  {
    section: "pb-4",
    rule: "border-border/70 pt-3.5 pb-1",
    numeral: "text-2xl font-semibold text-foreground/85",
    label: "text-lg font-semibold",
  },
  {
    section: "pb-3",
    rule: "border-border/60 pt-3 pb-1",
    numeral: "text-xl font-medium text-foreground/60",
    label: "text-base font-medium text-foreground/85",
  },
  {
    section: "pb-2.5",
    rule: "border-border/50 pt-2.5 pb-0.5",
    numeral: "text-lg font-medium text-foreground/45",
    label: "text-[15px] font-medium text-foreground/70",
  },
  {
    section: "pb-2",
    rule: "border-border/40 pt-2.5 pb-0.5",
    numeral: "",
    label: "text-sm font-medium text-muted-foreground",
  },
  {
    section: "pb-2",
    rule: "border-border/30 pt-2 pb-0.5",
    numeral: "",
    label: "text-[13px] font-medium text-muted-foreground/70",
  },
];
