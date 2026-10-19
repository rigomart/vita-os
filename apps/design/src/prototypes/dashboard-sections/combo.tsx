import { itemKey } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { ListProps } from "./board";

import { isNow } from "./board";
import { ItemRow } from "./row";
import { RuledHeading } from "./strip";
import { Chip, FarNames } from "./zoom";

/**
 * Week strip's plain list, ruled headings and all, with Zoom's forms by
 * distance: Late and Today as big cards, one to a row; the rest of the week
 * as lines (`week="lines"`) or chips (`week="chips"`); weeks and months as
 * one run of names.
 */
export function ComboList({
  groups,
  scope,
  week,
}: ListProps & { week: "chips" | "lines" }) {
  return (
    <div className="flex flex-col pt-1">
      {groups.map((group) => (
        <section
          key={group.key}
          aria-label={group.label}
          className={cn(isNow(group) ? "pb-5" : "pb-3")}
        >
          <RuledHeading group={group} scope={scope} />
          {isNow(group) ? (
            <ul className="flex flex-col gap-2 pt-1.5">
              {group.items.map((item) => (
                <li
                  key={itemKey(item)}
                  className={cn(
                    "rounded-2xl border bg-card shadow-xs [&_[data-slot=thread-copy]]:rounded-2xl",
                    group.tone === "late"
                      ? "border-condition-attention/35 bg-[color-mix(in_oklab,var(--color-condition-attention)_6%,var(--color-card))]"
                      : "border-border",
                  )}
                >
                  <ItemRow
                    item={item}
                    scope={scope}
                    dateInHeading={group.exact}
                    big
                    stacked
                  />
                </li>
              ))}
            </ul>
          ) : group.tone === "far" ? (
            <p className="px-1 pt-0.5 text-sm">
              <FarNames group={group} scope={scope} />
            </p>
          ) : week === "chips" ? (
            <ul className="flex flex-wrap gap-1.5 px-1 pt-1.5">
              {group.items.map((item) => (
                <li key={itemKey(item)} className="max-w-full min-w-0">
                  <Chip item={item} scope={scope} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="-mx-1.5">
              {group.items.map((item) => (
                <li key={itemKey(item)}>
                  <ItemRow
                    item={item}
                    scope={scope}
                    dateInHeading={group.exact}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function ZoomLinesList(props: ListProps) {
  return <ComboList {...props} week="lines" />;
}

export function ZoomChipsList(props: ListProps) {
  return <ComboList {...props} week="chips" />;
}
