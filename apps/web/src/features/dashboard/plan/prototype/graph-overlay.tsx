// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { cn } from "@vita-os/ui/lib/utils";

import { type ChipAnchor, useChipAnchors } from "./use-chip-anchors";

/** How far left of a chip the branch leaves the rail. */
const RUN = 16;
/** Corner radius of the two 90° turns. */
const RADIUS = 6;
/** Vertical slack within which a chip counts as sitting *on* the rail. */
const ON_RAIL = 4;

/**
 * Orthogonal branch from the rail up/down to one chip: run along the rail,
 * round the corner, climb, round back, arrive horizontally at the chip's left
 * edge. Returns `null` when the chip already sits on the rail (the rail itself
 * reaches it) and falls back to a flat tail when there is no room to turn.
 */
function branchPath(anchor: ChipAnchor, railY: number): string | null {
  const dy = anchor.y - railY;
  if (Math.abs(dy) <= ON_RAIL) return null;

  const vx = anchor.x - RUN;
  const r = Math.min(RADIUS, Math.abs(dy) / 2, RUN / 2);
  if (vx - r < 0) return `M 0 ${anchor.y} L ${anchor.x} ${anchor.y}`;

  const s = dy > 0 ? 1 : -1;
  return [
    `M ${vx - r} ${railY}`,
    `Q ${vx} ${railY} ${vx} ${railY + s * r}`,
    `L ${vx} ${anchor.y - s * r}`,
    `Q ${vx} ${anchor.y} ${vx + r} ${anchor.y}`,
    `L ${anchor.x} ${anchor.y}`,
  ].join(" ");
}

/**
 * Variant "graph": the lane drawn as a git commit graph / subway line. A rail
 * runs along the lane's vertical center from x=0 (emerging from behind the
 * opaque sticky header) to the last chip, and each chip is reached by a
 * stepped, rounded-corner branch off that rail with a commit dot at the end.
 *
 * Self-measuring; `containerRef` must be `relative` and the chips must paint
 * above `z-0`.
 */
export function GraphOverlay({
  containerRef,
  tone = "text-border dark:text-foreground/30",
}: {
  /** The lane row the graph is drawn across. Must be `relative`. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** `currentColor` source for rail, branches and dots. */
  tone?: string;
}) {
  const { anchors, height, width } = useChipAnchors(containerRef);
  if (anchors.length === 0 || width === 0 || height === 0) return null;

  const railY = height / 2;
  const railEnd = anchors[anchors.length - 1]?.x ?? 0;

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", tone)}
      height={height}
      width={width}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.5}
      >
        <line x1={0} x2={railEnd} y1={railY} y2={railY} />
        {anchors.map((anchor) => {
          const d = branchPath(anchor, railY);
          return d ? <path d={d} key={`branch:${anchor.id}`} /> : null;
        })}
      </g>
      {anchors.map((anchor) => (
        <g key={`dot:${anchor.id}`}>
          <circle
            cx={anchor.x}
            cy={anchor.y}
            fill="var(--surface-1)"
            r={4.5}
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <circle cx={anchor.x} cy={anchor.y} fill="currentColor" r={3} />
        </g>
      ))}
    </svg>
  );
}
