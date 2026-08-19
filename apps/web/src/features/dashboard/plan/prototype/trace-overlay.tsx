// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { cn } from "@vita-os/ui/lib/utils";
import { useId } from "react";

import { useChipAnchors } from "./use-chip-anchors";

/** Stroke weight of a tail, and so the height of its gradient rect. */
const WEIGHT = 1.5;
/** Radius of the dot that kisses the chip's left edge. */
const DOT = 2.5;

/**
 * Variant "trace": every chip trails its own history. Each chip gets a
 * horizontal tail at its own vertical center running from x=0 — out of the
 * opaque sticky header — to the chip's left edge, fading up from nothing so it
 * reads as a thread that has been running for a while rather than a connector
 * between chips.
 *
 * Each tail is a `<rect>` filled with one shared `objectBoundingBox` gradient:
 * because the gradient is relative to each rect's own box, a single definition
 * stretches correctly across tails of any length.
 *
 * Self-measuring; `containerRef` must be `relative` and the chips must paint
 * above `z-0`.
 */
export function TraceOverlay({
  containerRef,
  tone = "text-border dark:text-foreground/30",
}: {
  /** The lane row the traces are drawn across. Must be `relative`. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** `currentColor` source for tails and dots. */
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
        return (
          <g key={anchor.id}>
            {tailEnd > 0 && (
              <rect
                fill={`url(#${gradientId})`}
                height={WEIGHT}
                width={tailEnd}
                x={0}
                y={anchor.y - WEIGHT / 2}
              />
            )}
            <circle
              cx={anchor.x - DOT}
              cy={anchor.y}
              fill="currentColor"
              r={DOT}
            />
          </g>
        );
      })}
    </svg>
  );
}
