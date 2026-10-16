import type { WindowPlacement } from "./preferences.ts";

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How much of the window must still be on a display to reopen it there. */
const MIN_VISIBLE = 100;

/**
 * The saved placement when enough of it is on one of today's displays to
 * reach and drag, or nothing, so the window opens at its default size, centred.
 * A display unplugged since the last launch would otherwise strand it.
 */
export function placementOnScreen(
  saved: WindowPlacement | undefined,
  workAreas: readonly Rectangle[],
): WindowPlacement | undefined {
  if (saved === undefined) return undefined;
  const onScreen = workAreas.some((area) => {
    const width =
      Math.min(saved.x + saved.width, area.x + area.width) -
      Math.max(saved.x, area.x);
    const height =
      Math.min(saved.y + saved.height, area.y + area.height) -
      Math.max(saved.y, area.y);
    return width >= MIN_VISIBLE && height >= MIN_VISIBLE;
  });
  return onScreen ? saved : undefined;
}
