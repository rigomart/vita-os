import { cn } from "@vita-os/ui/lib/utils";
import { useId } from "react";

import { useChipAnchors } from "./use-chip-anchors";

/** Stroke weight of a tail, and so the height of its gradient rect. */
const WEIGHT = 2;
/** Radius of the dot that kisses the chip's left edge. */
const DOT = 3;
/** How far back a comet tail reaches from the chip it trails. */
const TAIL = 56;
/** Left inset the tail tip never crosses. */
const EDGE = 2;
/** Below this much room, a chip is too close to the edge to earn a tail. */
const MIN_TAIL = 10;
/** Gap between a chip's right edge and its leading tick, and the tick's length. */
const TICK_GAP = 2;
const TICK_END = 14;

/**
 * Every chip's wake, drawn across one lane row.
 *
 * A Thread on the Plan is an effort already in motion, and the chip alone says
 * only where it sits today. So each chip trails its own short comet tail —
 * where it has been, fading out behind it — meeting a dot at its left edge, and
 * points at a dashed tick ahead of its right edge for where it goes next.
 * Nothing spans the lane: two chips in a row read as two Threads in motion, not
 * as one connector between them.
 *
 * Each tail is a `<rect>` filled from one shared `objectBoundingBox` gradient —
 * because the gradient is relative to each rect's own box, a single definition
 * stretches correctly across tails of any length.
 *
 * Self-measuring, and so mount-sensitive: `containerRef` must be `relative`,
 * and the chips and header must paint above `z-0` on an opaque surface, since
 * the wake is drawn under them and relies on being covered where they overlap.
 */
export function LaneTraces({
  containerRef,
  tone = "text-muted-foreground/60 dark:text-foreground/50",
}: {
  /** The lane row the wakes are drawn across. Must be `relative`. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** `currentColor` source for tails, dots and ticks. */
  tone?: string;
}) {
  const gradientId = useId();
  const { anchors, height, width } = useChipAnchors(containerRef);
  if (anchors.length === 0 || width === 0 || height === 0) return null;

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", tone)}
      height={height}
      width={width}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity={0} />
          <stop offset="0.65" stopColor="currentColor" stopOpacity={0.55} />
          <stop offset="1" stopColor="currentColor" stopOpacity={1} />
        </linearGradient>
      </defs>

      {anchors.map((anchor) => {
        const tailEnd = anchor.x - DOT;
        const tailStart = Math.max(EDGE, anchor.x - TAIL);
        const tailWidth = tailEnd - tailStart;
        const tickStart = Math.min(anchor.x + anchor.w + TICK_GAP, width);
        const tickEnd = Math.min(anchor.x + anchor.w + TICK_END, width);

        return (
          <g key={anchor.id}>
            {tailWidth >= MIN_TAIL && (
              <rect
                fill={`url(#${gradientId})`}
                height={WEIGHT}
                width={tailWidth}
                x={tailStart}
                y={anchor.y - WEIGHT / 2}
              />
            )}
            <circle cx={tailEnd} cy={anchor.y} fill="currentColor" r={DOT} />
            {tickEnd > tickStart && (
              <line
                opacity={0.6}
                stroke="currentColor"
                strokeDasharray="2 3"
                strokeWidth={WEIGHT}
                x1={tickStart}
                x2={tickEnd}
                y1={anchor.y}
                y2={anchor.y}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
