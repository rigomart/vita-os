import type {
  Collision,
  CollisionDetection,
  DroppableContainer,
  UniqueIdentifier,
} from "@dnd-kit/core";

import { pointerWithin } from "@dnd-kit/core";

import type { SlotDropData } from "./plan-axis";

/** Client coordinates of the cursor, in the viewport's own frame. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The Later bay — the one droppable on the canvas that does not move with the
 * content it sits in.
 *
 * dnd-kit measures every droppable once at drag start and keeps those rects
 * honest by subtracting the scroll their element's scrollable ancestors have
 * done since (`Rect`'s top/left/right/bottom are getters, not values). That is
 * exactly right for a day cell, which really does travel left as the canvas
 * scrolls. The Later bay is `sticky right-0` inside the same scroller: it never
 * moves on screen, yet its rect is compensated all the same, so after N px of
 * autoscroll dnd-kit believes it sits N px to the left of where it is. The
 * cursor stops falling inside it — the drop misses — and the drifted rect can
 * land over the day region and steal a collision instead.
 *
 * The Waiting bay and the ruler scroll with the days, and the No date bucket
 * lives outside the scroller entirely, so their rects stay true and are left to
 * `pointerWithin`.
 */
const STICKY_SLOT = "beyond";

export function isStickyBay(container: DroppableContainer): boolean {
  const data = container.data.current as SlotDropData | undefined;
  return data?.slotKey === STICKY_SLOT;
}

/** The subset of a `DOMRect` a hit test needs. */
export interface HitRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/**
 * The first candidate whose rect contains `point`, in the order given. One
 * sticky bay per lane, stacked, so first-hit is unambiguous.
 */
export function hitRect(
  candidates: readonly { id: UniqueIdentifier; rect: HitRect }[],
  point: Point,
): UniqueIdentifier | null {
  for (const { id, rect } of candidates) {
    if (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Plan's collision detection: the sticky Later bays are hit-tested against
 * their **live** rect, everything else keeps dnd-kit's `pointerWithin` over the
 * rects measured at drag start.
 *
 * `pointerCoordinates` is the cursor as the sensor saw it — raw client
 * coordinates, no scroll folded in — so it is the honest half of the pairing.
 * Only the stored rects drift, and re-reading the bay's own
 * `getBoundingClientRect` is what undoes it. The bays are dropped from the
 * `pointerWithin` pass too, so a drifted rect cannot steal a day's drop.
 */
export const planCollisionDetection: CollisionDetection = (args) => {
  const point = args.pointerCoordinates;
  if (point == null) return pointerWithin(args);

  const sticky = args.droppableContainers.filter(isStickyBay);
  const hit = hitRect(
    sticky.flatMap((container) => {
      const rect = container.node.current?.getBoundingClientRect();
      return rect ? [{ id: container.id, rect }] : [];
    }),
    point,
  );

  if (hit != null) {
    const container = sticky.find((candidate) => candidate.id === hit)!;
    return [
      { data: { droppableContainer: container, value: 0 }, id: hit },
    ] satisfies Collision[];
  }

  return pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => !isStickyBay(container),
    ),
  });
};
