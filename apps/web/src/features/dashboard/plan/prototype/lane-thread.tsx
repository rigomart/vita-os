// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useState } from "react";

type Anchor = { x: number; y: number };

type Measurement = { anchors: Anchor[]; height: number; width: number };

const EMPTY: Measurement = { anchors: [], height: 0, width: 0 };

function measure(container: HTMLElement): Measurement {
  const box = container.getBoundingClientRect();
  const anchors = Array.from(
    container.querySelectorAll<HTMLElement>("[data-chip]"),
  )
    .map((chip) => {
      const rect = chip.getBoundingClientRect();
      return {
        x: rect.left - box.left,
        y: rect.top - box.top + rect.height / 2,
      };
    })
    .sort((a, b) => a.x - b.x);
  return { anchors, height: box.height, width: box.width };
}

function buildPath(anchors: Anchor[]): string {
  const [first, ...rest] = anchors;
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  let prev = first;
  for (const point of rest) {
    const dx = point.x - prev.x;
    const sag = Math.min(10, dx * 0.08);
    const midX = prev.x + dx / 2;
    const midY = Math.max(prev.y, point.y) + sag;
    d += ` Q ${midX} ${midY} ${point.x} ${point.y}`;
    prev = point;
  }
  return d;
}

/**
 * One literal thread per lane: it enters at the leftmost chip, runs to each
 * following chip with a gentle sag between them, and ties a small knot at every
 * chip anchor.
 *
 * Self-measuring and prototype-grade — it reads `[data-chip]` elements out of
 * `containerRef` on mount, on resize, and on DOM mutation, then draws in the
 * container's pixel space. The container must be `relative` and the chips should
 * sit above `z-0` so the thread passes behind them.
 */
export function LaneThread({
  containerRef,
  tone = "text-border dark:text-foreground/25",
}: {
  /** The lane row the thread is drawn across. Must be `relative`. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** `currentColor` source for stroke and knots. */
  tone?: string;
}) {
  const [state, setState] = useState<Measurement>(EMPTY);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setState(measure(container)));
    };

    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(container);

    let mutation: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      mutation = new MutationObserver(schedule);
      mutation.observe(container, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation?.disconnect();
    };
  }, [containerRef]);

  const { anchors, height, width } = state;
  if (anchors.length === 0 || width === 0 || height === 0) return null;

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0 size-full", tone)}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {anchors.length > 1 && (
        <path
          d={buildPath(anchors)}
          fill="none"
          stroke="currentColor"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeWidth={1.5}
        />
      )}
      {anchors.map((anchor) => (
        <circle
          cx={anchor.x}
          cy={anchor.y}
          fill="none"
          key={`${anchor.x}:${anchor.y}`}
          r={2.5}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
