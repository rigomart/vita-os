/** Where a floating control can rest: each corner and the middle of each edge. */
export const snapPoints = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type SnapPoint = (typeof snapPoints)[number];

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  left: number;
  top: number;
}

/** Room kept between the control and the viewport's edges. */
const MARGIN = 16;

/** Where a box of `box`'s size rests at `point`, in viewport pixels. */
export function positionAt(
  point: SnapPoint,
  box: Size,
  viewport: Size,
): Position {
  const [edge, along] = point.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  return {
    top: edge === "top" ? MARGIN : viewport.height - box.height - MARGIN,
    left:
      along === "left"
        ? MARGIN
        : along === "center"
          ? (viewport.width - box.width) / 2
          : viewport.width - box.width - MARGIN,
  };
}

/** The snap point closest to where the box was let go. */
export function nearestSnapPoint(
  dropped: Position,
  box: Size,
  viewport: Size,
): SnapPoint {
  const distance = (point: SnapPoint) => {
    const at = positionAt(point, box, viewport);
    return Math.hypot(at.left - dropped.left, at.top - dropped.top);
  };
  return snapPoints.reduce((best, point) =>
    distance(point) < distance(best) ? point : best,
  );
}

export function isSnapPoint(value: unknown): value is SnapPoint {
  return snapPoints.includes(value as SnapPoint);
}
