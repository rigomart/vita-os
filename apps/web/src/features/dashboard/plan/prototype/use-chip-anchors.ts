// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { useEffect, useState } from "react";

/** A chip's left edge and vertical center, in the container's pixel space. */
export interface ChipAnchor {
  /** The `data-chip` attribute value of the measured chip. */
  id: string;
  /** The chip's measured width, so callers can reach its right edge. */
  w: number;
  x: number;
  y: number;
}

export interface ChipAnchors {
  anchors: ChipAnchor[];
  height: number;
  width: number;
}

const EMPTY: ChipAnchors = { anchors: [], height: 0, width: 0 };

function measure(container: HTMLElement): ChipAnchors {
  const box = container.getBoundingClientRect();
  const anchors = Array.from(
    container.querySelectorAll<HTMLElement>("[data-chip]"),
  )
    .map((chip) => {
      const rect = chip.getBoundingClientRect();
      return {
        id: chip.dataset.chip ?? "",
        w: rect.width,
        x: rect.left - box.left,
        y: rect.top - box.top + rect.height / 2,
      };
    })
    .sort((a, b) => a.x - b.x);
  return { anchors, height: box.height, width: box.width };
}

/**
 * Reads every `[data-chip]` element inside `containerRef` and reports its left
 * edge, vertical center and width relative to the container, plus the
 * container's own box. Re-measures on mount, on resize, and on DOM mutation,
 * debounced to one animation frame.
 *
 * The container must be `relative` for the numbers to line up with an overlay
 * drawn at `absolute inset-0`. SSR-safe: measurement is skipped entirely when
 * `ResizeObserver` is unavailable.
 */
export function useChipAnchors(
  containerRef: React.RefObject<HTMLElement | null>,
): ChipAnchors {
  const [state, setState] = useState<ChipAnchors>(EMPTY);

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

  return state;
}
