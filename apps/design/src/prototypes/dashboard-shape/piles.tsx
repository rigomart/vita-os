import { itemKey } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { useState } from "react";

import type { BodyProps } from "./board";

import { BandCount } from "./board";
import { ItemCard } from "./tile";

/** How many sheet edges a closed pile draws under its top card. */
const EDGES = 6;

/**
 * Untangle's glance, on the product's data: one pile per span, side by
 * side, each a large count over its first card and the edges of the rest.
 * A pile fans out in place when clicked. The shape of the board is read
 * from the counts and the pile heights before any title.
 */
export function Piles({ bands, scope }: BodyProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-5">
      {bands.map((band) => {
        const fanned = open.has(band.key);
        const [first, ...rest] = band.items;
        const late = band.key === "late";
        return (
          <section key={band.key} aria-label={band.label} className="min-w-0">
            <h2 className="flex items-baseline gap-2 px-1 pb-2">
              <BandCount band={band} className="text-4xl" />
              <span
                className={cn(
                  "font-heading font-semibold",
                  band.distance === 0
                    ? "text-base"
                    : "text-sm text-foreground/70",
                  late && band.items.length > 0 && "text-condition-attention",
                )}
              >
                {band.label}
              </span>
            </h2>
            {first === undefined ? (
              <div className="rounded-xl px-3 py-4 text-sm text-muted-foreground ring-1 ring-border/40 ring-dashed">
                Nothing {band.key === "today" ? "today" : "here"}.
              </div>
            ) : fanned ? (
              <ul className="flex flex-col gap-1.5">
                {band.items.map((item) => (
                  <li key={itemKey(item)}>
                    <ItemCard
                      item={item}
                      scope={scope}
                      distance={band.distance === 0 ? 0 : 2}
                      late={late}
                    />
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="w-full rounded-lg py-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => toggle(band.key)}
                  >
                    Close the pile
                  </button>
                </li>
              </ul>
            ) : (
              <div>
                <ItemCard
                  item={first}
                  scope={scope}
                  distance={band.distance === 0 ? 0 : 2}
                  late={late}
                  className="z-10"
                />
                {rest.length > 0 && (
                  <button
                    type="button"
                    aria-label={`Show all ${band.items.length} in ${band.label}`}
                    className="group block w-full"
                    onClick={() => toggle(band.key)}
                  >
                    {rest.slice(0, EDGES).map((item, index) => (
                      <span
                        key={itemKey(item)}
                        className={cn(
                          "mx-auto -mt-1 block h-2 rounded-b-lg bg-surface-2 ring-1 ring-border/50 group-hover:bg-surface-3",
                          late &&
                            "bg-[color-mix(in_oklab,var(--condition-attention)_10%,var(--color-surface-2))]",
                        )}
                        style={{ width: `${96 - index * 3}%` }}
                      />
                    ))}
                    <span className="block pt-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                      and {rest.length} more
                    </span>
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
