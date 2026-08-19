import type { DroppableContainer } from "@dnd-kit/core";

import { describe, expect, it } from "vitest";

import type { SlotDropData } from "./plan-axis";

import { hitRect, isStickyBay, planCollisionDetection } from "./plan-collision";

function rect(left: number, right: number) {
  return { bottom: 100, height: 100, left, right, top: 0, width: right - left };
}

/**
 * A droppable as collision detection meets it: `live` is what the node's own
 * `getBoundingClientRect` reports now, which is the only truth the sticky pass
 * consults.
 */
function droppable(
  id: string,
  data: SlotDropData,
  live: ReturnType<typeof rect>,
): DroppableContainer {
  return {
    data: { current: data },
    disabled: false,
    id,
    node: {
      current: { getBoundingClientRect: () => live } as unknown as HTMLElement,
    },
    rect: { current: null },
  } as unknown as DroppableContainer;
}

function detect(
  containers: DroppableContainer[],
  /** The rects dnd-kit measured at drag start, scroll-compensated since. */
  measured: Map<string, ReturnType<typeof rect>>,
  /** The cursor, in raw client coordinates — what dnd-kit passes through. */
  cursor: { x: number; y: number } | null,
) {
  return planCollisionDetection({
    active: {} as never,
    collisionRect: {} as never,
    droppableContainers: containers,
    droppableRects: measured as never,
    pointerCoordinates: cursor,
  });
}

describe("hitRect", () => {
  it("names the first candidate whose rect holds the point", () => {
    const candidates = [
      { id: "a", rect: rect(0, 100) },
      { id: "b", rect: rect(100, 200) },
    ];
    expect(hitRect(candidates, { x: 150, y: 50 })).toBe("b");
    expect(hitRect(candidates, { x: 250, y: 50 })).toBeNull();
  });
});

describe("isStickyBay", () => {
  it("counts the Later bay, and nothing that scrolls with the days", () => {
    expect(isStickyBay(droppable("x", { slotKey: "beyond" }, rect(0, 1)))).toBe(
      true,
    );
    for (const slotKey of ["overdue", "none", "d3"]) {
      expect(isStickyBay(droppable("x", { slotKey }, rect(0, 1)))).toBe(false);
    }
  });
});

describe("planCollisionDetection", () => {
  // The canvas has autoscrolled 400px. The Later bay never moved — it is still
  // at 300–400 on screen — but dnd-kit has compensated its measured rect by the
  // scroll, so that rect now reads -100–0. The day cell that genuinely scrolled
  // into 300–400 keeps a measured rect that matches where it really is.
  const later = droppable(
    "home::beyond",
    { laneId: "home", slotKey: "beyond" },
    rect(300, 400),
  );
  const day = droppable(
    "home::d3",
    { laneId: "home", slotKey: "d3" },
    rect(300, 400),
  );
  const measured = new Map([
    ["home::beyond", rect(-100, 0)],
    ["home::d3", rect(300, 400)],
  ]);

  it("lands on the Later bay under the cursor, however far the canvas scrolled", () => {
    // Both the bay and the day cell are under the cursor on screen; the bay is
    // in front, and the drifted rect must not decide it either way.
    expect(detect([day, later], measured, { x: 350, y: 50 })[0]?.id).toBe(
      "home::beyond",
    );
  });

  it("leaves day cells to dnd-kit's own measured rects", () => {
    const scrolledDay = droppable(
      "home::d1",
      { laneId: "home", slotKey: "d1" },
      rect(-100, 0),
    );
    const rects = new Map([
      ["home::beyond", rect(-100, 0)],
      ["home::d1", rect(100, 200)],
    ]);
    expect(detect([scrolledDay, later], rects, { x: 150, y: 50 })[0]?.id).toBe(
      "home::d1",
    );
  });

  it("refuses the drifted bay rect a collision of its own", () => {
    // The cursor sits where the bay's stale rect drifted to, over nothing else.
    expect(detect([day, later], measured, { x: -50, y: 50 })).toHaveLength(0);
  });

  it("hands a cursorless pass straight to pointerWithin, which has nothing to go on", () => {
    const rects = new Map([["home::beyond", rect(300, 400)]]);
    expect(detect([later], rects, null)).toHaveLength(0);
  });
});
