import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

export interface ScrollMetrics {
  clientWidth: number;
  scrollLeft: number;
  scrollWidth: number;
}

const EMPTY: ScrollMetrics = { clientWidth: 0, scrollLeft: 0, scrollWidth: 0 };

/** Below this the thumb stops shrinking, however long the canvas gets. */
const MIN_THUMB = "1.75rem";

/**
 * Live geometry of a horizontal scroller: enough to place both the edge fades
 * and the scrollbar without either measuring the node itself.
 */
export function useScrollMetrics(node: HTMLElement | null): ScrollMetrics {
  const [metrics, setMetrics] = useState<ScrollMetrics>(EMPTY);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;

    const read = () => {
      // A detached or zero-width node measures as "nothing overflows"; ignore
      // it rather than flashing the fades and the bar off.
      if (node.clientWidth === 0) return;
      setMetrics((previous) =>
        previous.clientWidth === node.clientWidth &&
        previous.scrollLeft === node.scrollLeft &&
        previous.scrollWidth === node.scrollWidth
          ? previous
          : {
              clientWidth: node.clientWidth,
              scrollLeft: node.scrollLeft,
              scrollWidth: node.scrollWidth,
            },
      );
    };

    read();
    node.addEventListener("scroll", read, { passive: true });

    const observer = new ResizeObserver(read);
    observer.observe(node);
    // The scroller's own box does not change when the canvas grows a column or
    // a lane — the content wrapper's does, so watch that too.
    const content = node.firstElementChild;
    if (content) observer.observe(content);

    return () => {
      node.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [node]);

  return metrics;
}

export interface ScrollbarGeometry {
  /** How far along the scroll is, 0 to 1. */
  progress: number;
  /** Thumb length as a fraction of the track. */
  size: number;
}

/**
 * Where the thumb sits and how long it is, given the scroller's geometry and
 * the width of the pinned lane header column.
 *
 * The thumb is measured against the day region alone: a pinned column is
 * always on screen, so it belongs to neither the viewport nor the content
 * being represented. Returns null when nothing overflows.
 */
export function scrollbarGeometry(
  metrics: ScrollMetrics,
  start: number,
  end: number,
): ScrollbarGeometry | null {
  const max = metrics.scrollWidth - metrics.clientWidth;
  if (max <= 1) return null;

  const days = metrics.clientWidth - start - end;
  const span = metrics.scrollWidth - start - end;

  return {
    progress: clamp(metrics.scrollLeft / max, 0, 1),
    size: span > 0 ? clamp(days / span, 0, 1) : 1,
  };
}

interface Grip {
  /** Track pixels the thumb can travel. */
  free: number;
  /** Where inside the thumb the pointer took hold. */
  offset: number;
  max: number;
  trackLeft: number;
}

/**
 * The Plan canvas' own horizontal scrollbar.
 *
 * The native one spans the whole scroller, which puts it under the pinned lane
 * header column — a column that never moves — reading as if it scrolled too.
 * This one is inset to the day region alone, so its extent is the extent of
 * what actually slides, and it is sized against that region rather than the
 * full viewport.
 *
 * It is a pointer affordance only, hidden from assistive tech: it restores what
 * the native bar offered a mouse, and the scroller keeps its own scrollable
 * region semantics for everyone else.
 */
export function PlanScrollbar({
  end,
  metrics,
  node,
  start,
}: {
  /** Inset from the right edge, for anything pinned there. */
  end: number;
  metrics: ScrollMetrics;
  node: HTMLElement | null;
  /** Inset from the left edge: the pinned lane header column. */
  start: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<Grip | null>(null);
  const [dragging, setDragging] = useState(false);

  const geometry = scrollbarGeometry(metrics, start, end);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb || !node) return;

    const free = track.clientWidth - thumb.offsetWidth;
    const reach = node.scrollWidth - node.clientWidth;
    if (free <= 0 || reach <= 0) return;

    const box = thumb.getBoundingClientRect();
    const grip: Grip = {
      free,
      max: reach,
      // Anywhere but the thumb is a jump: take hold at its midpoint so it
      // lands centred under the pointer and can be dragged on from there.
      offset:
        event.clientX >= box.left && event.clientX <= box.right
          ? event.clientX - box.left
          : thumb.offsetWidth / 2,
      trackLeft: track.getBoundingClientRect().left,
    };

    gripRef.current = grip;
    event.preventDefault();
    track.setPointerCapture(event.pointerId);
    setDragging(true);
    scrollTo(event.clientX, grip);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const grip = gripRef.current;
    if (grip) scrollTo(event.clientX, grip);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    gripRef.current = null;
    setDragging(false);
    trackRef.current?.releasePointerCapture(event.pointerId);
  }

  function scrollTo(clientX: number, grip: Grip) {
    if (!node) return;
    const travelled = clamp(
      clientX - grip.trackLeft - grip.offset,
      0,
      grip.free,
    );
    node.scrollLeft = (travelled / grip.free) * grip.max;
  }

  if (!geometry) return null;

  const { progress, size } = geometry;

  return (
    <div
      ref={trackRef}
      aria-hidden
      className="group/bar absolute bottom-0 z-50 h-2.5 cursor-pointer touch-none"
      style={{ left: start, right: end }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span className="pointer-events-none absolute inset-x-0 bottom-0.5 h-1.5 rounded-full bg-foreground/[0.07]" />
      <div
        ref={thumbRef}
        className={cn(
          "pointer-events-none absolute bottom-0.5 h-1.5 rounded-full transition-colors",
          dragging
            ? "bg-foreground/45"
            : "bg-foreground/20 group-hover/bar:bg-foreground/35",
        )}
        style={{
          left: `calc(${progress} * (100% - max(${size * 100}%, ${MIN_THUMB})))`,
          width: `max(${size * 100}%, ${MIN_THUMB})`,
        }}
      />
    </div>
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
