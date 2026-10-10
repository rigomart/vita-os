import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";

import {
  isSnapPoint,
  nearestSnapPoint,
  type Position,
  positionAt,
  type Size,
  type SnapPoint,
} from "./snap-points";

/** How far the pointer travels before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Drag a fixed element anywhere; let go and it snaps to the nearest corner or
 * edge middle, which it keeps across reloads under `storageKey`. A press on
 * one of its buttons or links stays a click.
 */
export function useSnappedPlacement(storageKey: string, initial: SnapPoint) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<SnapPoint>(() => {
    const stored = window.localStorage.getItem(storageKey);
    return isSnapPoint(stored) ? stored : initial;
  });
  const [layout, setLayout] = useState<{ box: Size; viewport: Size } | null>(
    null,
  );
  const [dragged, setDragged] = useState<Position | null>(null);
  const press = useRef<{ x: number; y: number; from: Position } | null>(null);

  // Measured before the first paint, and again when the element or window
  // resizes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () =>
      setLayout({
        box: { width: element.offsetWidth, height: element.offsetHeight },
        viewport: {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button, a")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      press.current = {
        x: event.clientX,
        y: event.clientY,
        from: { left: rect.left, top: rect.top },
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const start = press.current;
      if (start === null) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dragged === null && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      setDragged({ left: start.from.left + dx, top: start.from.top + dy });
    },
    onPointerUp: () => {
      press.current = null;
      if (dragged !== null && layout !== null) {
        const next = nearestSnapPoint(dragged, layout.box, layout.viewport);
        setPoint(next);
        window.localStorage.setItem(storageKey, next);
      }
      setDragged(null);
    },
    onPointerCancel: () => {
      press.current = null;
      setDragged(null);
    },
  };

  const style =
    dragged ??
    (layout === null
      ? { right: 16, bottom: 16 }
      : positionAt(point, layout.box, layout.viewport));

  return { ref, handlers, style, point, dragging: dragged !== null };
}
