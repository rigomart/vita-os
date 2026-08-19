// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { cn } from "@vita-os/ui/lib/utils";

import { type ChipAnchor, useChipAnchors } from "./use-chip-anchors";

/** Corner radius of the two 90° turns in a step between chips. */
const RADIUS = 6;
/** Vertical slack within which two chips count as sitting on the same line. */
const SAME_LINE = 4;
/** How far past the last chip the branch trails off into the future. */
const STUB = 28;

/**
 * Appends the run from `from` to `to`: a straight line when both sit on the
 * same line, otherwise an orthogonal step whose vertical leg is placed midway
 * between the two so the line reads as a subway hop rather than a hook onto
 * the destination. The corner radius shrinks to fit both the gap and the drop.
 */
function step(from: ChipAnchor, to: ChipAnchor): string {
  const dy = to.y - from.y;
  const dx = to.x - from.x;
  if (Math.abs(dy) <= SAME_LINE || dx <= 0) return `L ${to.x} ${to.y}`;

  const legX = from.x + dx / 2;
  const r = Math.min(RADIUS, Math.abs(dy) / 2, dx / 2);
  const s = dy > 0 ? 1 : -1;
  return [
    `L ${legX - r} ${from.y}`,
    `Q ${legX} ${from.y} ${legX} ${from.y + s * r}`,
    `L ${legX} ${to.y - s * r}`,
    `Q ${legX} ${to.y} ${legX + r} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(" ");
}

/**
 * Variant "graph": the Area lane drawn as a git branch, its threads the
 * commits on it. One line enters from x=0 at the first chip's height (emerging
 * from behind the opaque sticky header), threads through every chip in x order
 * with rounded orthogonal steps between rows, carries a ringed commit node at
 * each chip, and trails off past the last one as a dashed stub — the branch
 * continues into the future.
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
  /** `currentColor` source for the branch, nodes and stub. */
  tone?: string;
}) {
  const { anchors, height, width } = useChipAnchors(containerRef);
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!(first && last) || width === 0 || height === 0) return null;

  const d = anchors
    .reduce(
      (segments, anchor, index) => {
        const previous = anchors[index - 1];
        segments.push(
          previous ? step(previous, anchor) : `L ${anchor.x} ${anchor.y}`,
        );
        return segments;
      },
      [`M 0 ${first.y}`],
    )
    .join(" ");

  const stubEnd = Math.min(last.x + STUB, width);

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
        <path d={d} />
        {stubEnd > last.x ? (
          <path
            d={`M ${last.x} ${last.y} L ${stubEnd} ${last.y}`}
            opacity={0.5}
            strokeDasharray="2 4"
          />
        ) : null}
      </g>
      {anchors.map((anchor) => (
        <g key={`node:${anchor.id}`}>
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
