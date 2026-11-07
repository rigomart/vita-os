import type { BoardItem } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";

import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { Band, BodyProps } from "./board";

import { BandCount, SpanLabel } from "./board";
import { ItemCard, ItemChip } from "./tile";

/** A tile's size at each distance, in pixels: nearer is larger. */
const TILE = {
  asking: { w: 214, h: 92 },
  near: { w: 168, h: 76 },
  week: { w: 132, h: 40 },
  far: { w: 112, h: 30 },
} as const;

/**
 * The treemap with its sizes made honest: a tile is a fixed size for how
 * near it is, so the mosaic's area is the load itself. A light day is a
 * small mosaic with room around it; a heavy one fills the page. Regions
 * keep the treemap's reading order, Late first, each a block led by its
 * count, packed side by side and wrapping.
 */
export function Mosaic({ bands, scope }: BodyProps) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {bands.map((band) => (
        <Region key={band.key} band={band} scope={scope} />
      ))}
    </div>
  );
}

function Region({ band, scope }: { band: Band; scope: BodyProps["scope"] }) {
  const tiles = sized(band, scope.currentDate);
  const columns = Math.max(1, Math.ceil(Math.sqrt(tiles.length * 0.9)));
  const late = band.key === "late";

  return (
    <section
      aria-label={band.label}
      className="rounded-2xl bg-surface-1 p-2 ring-1 ring-border/50"
    >
      <h2 className="flex items-baseline gap-2 px-1.5 pb-2">
        <BandCount
          band={band}
          className={band.distance === 0 ? "text-3xl" : "text-xl"}
        />
        <SpanLabel
          label={band.label}
          late={late && band.items.length > 0}
          className={cn(
            band.distance === 0 ? "text-base" : "text-sm text-foreground/70",
          )}
        />
      </h2>
      {tiles.length === 0 ? (
        <p className="px-1.5 pb-1 text-xs text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul
          className="flex flex-wrap gap-1.5"
          style={{
            maxWidth:
              columns * Math.max(...tiles.map((tile) => TILE[tile.size].w)) +
              (columns - 1) * 6,
          }}
        >
          {tiles.map(({ item, size }) => (
            <li
              key={itemKey(item)}
              style={{ width: TILE[size].w, height: TILE[size].h }}
            >
              {size === "asking" || size === "near" ? (
                <ItemCard
                  item={item}
                  scope={scope}
                  distance={size === "asking" ? 0 : 1}
                  late={late}
                  className="size-full overflow-hidden"
                />
              ) : (
                <ItemChip item={item} scope={scope} late={late} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sized(band: Band, currentDate: number) {
  const as = (size: keyof typeof TILE) => (item: BoardItem) => ({
    item,
    size,
  });
  if (band.distance === 0) return band.items.map(as("asking"));
  if (band.key === "later") return band.items.map(as("far"));
  if (band.key === "none") return band.items.map(as("week"));
  return groupByWhen(band.items, currentDate).flatMap((group) =>
    group.items.map(as(group.tone === "near" ? "near" : "week")),
  );
}
