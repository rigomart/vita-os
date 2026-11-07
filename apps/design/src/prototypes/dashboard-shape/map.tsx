import type { BoardItem } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";

import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

import type { Band, BodyProps } from "./board";

import { BandCount } from "./board";
import { squarify } from "./squarify";
import { ItemCard, ItemChip } from "./tile";

/** How much room one item takes, by how near it is: nearer is larger. */
const WEIGHT = { late: 6, today: 6, near: 3, soon: 2, week: 1.5 } as const;
const LATER_WEIGHT = 0.6;
const NO_DATE_WEIGHT = 1.1;
/** An empty span still gets a sliver, so "0 Today" is read, not missed. */
const EMPTY_WEIGHT = 2;
const HEADER = 38;
const GAP = 6;

/**
 * The time treemap: the whole board on one screen, nothing scrolled to.
 * Five regions in reading order, Late top-left to No date bottom-right,
 * each led by its count. Inside, every item is a tile whose size is how
 * near it is, ADR 0045's grading in two dimensions instead of down a list.
 * Late is the only colour. Areas size nothing.
 */
export function TimeMap({ bands, scope }: BodyProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const weighted = bands.map((band) => ({
    band,
    items: weigh(band, scope.currentDate),
  }));
  const regions = squarify(
    weighted.map((entry) => ({
      value: Math.max(
        EMPTY_WEIGHT,
        entry.items.reduce((sum, item) => sum + item.weight, 0),
      ),
      data: entry,
    })),
    { x: 0, y: 0, w: size.w, h: size.h },
  );

  return (
    <div
      ref={ref}
      className="relative h-[max(30rem,calc(100svh-12.5rem))] w-full"
    >
      {regions.map((region) => {
        const { band, items } = region.data;
        const inner = {
          x: GAP / 2,
          y: HEADER,
          w: region.w - GAP * 2,
          h: region.h - HEADER - GAP,
        };
        const tiles = squarify(
          items.map((item) => ({ value: item.weight, data: item.item })),
          inner,
        );
        return (
          <section
            key={band.key}
            aria-label={band.label}
            className="absolute overflow-hidden rounded-2xl bg-surface-1 ring-1 ring-border/50"
            style={{
              left: region.x + GAP / 2,
              top: region.y + GAP / 2,
              width: region.w - GAP,
              height: region.h - GAP,
            }}
          >
            <h2 className="flex h-[38px] items-baseline gap-2 px-3 pt-1.5">
              <BandCount
                band={band}
                className={band.distance === 0 ? "text-2xl" : "text-xl"}
              />
              <span
                className={cn(
                  "font-heading font-semibold tracking-tight",
                  band.distance === 0 ? "text-base" : "text-sm",
                  band.key === "late" &&
                    band.items.length > 0 &&
                    "text-condition-attention",
                  band.distance > 0 && "text-foreground/70",
                )}
              >
                {band.label}
              </span>
            </h2>
            {items.length === 0 && (
              <p className="px-3 text-xs text-muted-foreground">
                {band.key === "late"
                  ? "Nothing late."
                  : band.key === "today"
                    ? "Nothing today."
                    : "Nothing here."}
              </p>
            )}
            {tiles.map((tile) => {
              const late = band.key === "late";
              const roomy = tile.w >= 150 && tile.h >= 66;
              return (
                <div
                  key={itemKey(tile.data)}
                  className="absolute p-[3px]"
                  style={{
                    left: tile.x,
                    top: tile.y,
                    width: tile.w,
                    height: tile.h,
                  }}
                >
                  {roomy ? (
                    <ItemCard
                      item={tile.data}
                      scope={scope}
                      distance={band.distance === 0 ? 0 : 2}
                      late={late}
                      className="size-full overflow-hidden"
                    />
                  ) : (
                    <ItemChip item={tile.data} scope={scope} late={late} />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function weigh(band: Band, currentDate: number) {
  if (band.key === "later") {
    return band.items.map((item) => ({ item, weight: LATER_WEIGHT }));
  }
  if (band.key === "none") {
    return band.items.map((item) => ({ item, weight: NO_DATE_WEIGHT }));
  }
  return groupByWhen(band.items, currentDate).flatMap((group) =>
    group.items.map((item: BoardItem) => ({
      item,
      weight: group.tone === "far" ? LATER_WEIGHT : WEIGHT[group.tone],
    })),
  );
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect;
      setSize({ w: box.width, h: box.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
