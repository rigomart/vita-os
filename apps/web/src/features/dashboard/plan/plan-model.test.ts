import { describe, expect, it } from "vitest";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";

import type { DragState, PlanItem } from "./plan-model";

import {
  buildAxis,
  buildLanes,
  dayAt,
  HEADER_WIDTH,
  HEADER_WIDTH_NARROW,
  INBOX_LANE_ID,
  planDrop,
  slotKeyFor,
} from "./plan-model";

const now = new Date(2026, 7, 6, 9).getTime();

const items: PlanItem[] = [
  {
    areaId: "health",
    date: dayAt(-3, now),
    id: "t1",
    kind: "thread",
    title: "Late",
  },
  {
    areaId: "home",
    date: dayAt(2, now),
    id: "t2",
    kind: "thread",
    title: "Soon",
  },
  { areaId: "home", id: "t3", kind: "thread", title: "Undated" },
  { date: dayAt(1, now), id: "k1", kind: "task", title: "Task" },
];

const axis = buildAxis(items, now, "compact");

function drop(over: Partial<DragState>, base: Partial<DragState> = {}) {
  return planDrop(
    {
      itemId: "t2",
      kind: "thread",
      laneId: "home",
      slotKey: "d2",
      ...base,
      ...over,
    },
    axis,
    (id) => (id === INBOX_LANE_ID ? "Inbox" : "Home"),
  );
}

describe("plan axis", () => {
  it("opens occupied days and today, compresses the rest", () => {
    const today = axis.days[0];
    const occupied = axis.days.find((day) => day.offset === 2)!;
    const empty = axis.days.find((day) => day.offset === 5)!;

    expect(today.wide).toBe(true);
    expect(occupied.wide).toBe(true);
    expect(empty.wide).toBe(false);
    expect(axis.hasOverdue).toBe(true);
  });

  it("files dates into columns, past into the waiting bay", () => {
    const horizon = axis.days.length - 1;
    expect(slotKeyFor(dayAt(-3, now), now, horizon)).toBe("overdue");
    expect(slotKeyFor(dayAt(0, now), now, horizon)).toBe("d0");
    expect(slotKeyFor(undefined, now, horizon)).toBe("none");
  });

  it("narrows the header column when the component layer asks for it", () => {
    const compact = buildAxis(items, now, "compact", HEADER_WIDTH_NARROW);

    expect(compact.template.startsWith(`${HEADER_WIDTH_NARROW}px `)).toBe(true);
    expect(axis.template.startsWith(`${HEADER_WIDTH}px `)).toBe(true);
    expect(axis.minWidth - compact.minWidth).toBe(
      HEADER_WIDTH - HEADER_WIDTH_NARROW,
    );
  });
});

describe("plan lanes", () => {
  it("orders Areas worst condition first and keeps Tasks in the Inbox", () => {
    const { areaLanes, inbox } = buildLanes(
      items,
      [
        {
          condition: "healthy",
          icon: "Home",
          id: "home",
          name: "Home",
          order: 1,
          slug: "home",
        },
        {
          condition: "critical",
          icon: "HeartPulse",
          id: "health",
          name: "Health",
          order: 0,
          slug: "health",
        },
      ],
      now,
      axis.days.length - 1,
    );

    expect(areaLanes.map((lane) => lane.id)).toEqual(["health", "home"]);
    expect(areaLanes[0].overdue.map((item) => item.id)).toEqual(["t1"]);
    expect(areaLanes[0].plannedCount).toBe(0);
    expect(areaLanes[1].none.map((item) => item.id)).toEqual(["t3"]);
    expect(inbox.byDay.get("d1")?.map((item) => item.id)).toEqual(["k1"]);
  });
});

describe("day rollover", () => {
  const tomorrow = new Date(2026, 7, 7, 9).getTime();

  const home: DashboardArea[] = [
    {
      condition: "healthy",
      icon: "Home",
      id: "home",
      name: "Home",
      order: 0,
      slug: "home",
    },
  ];

  const dated: PlanItem[] = [
    {
      areaId: "home",
      date: dayAt(0, now),
      id: "today",
      kind: "thread",
      title: "Today",
    },
    {
      areaId: "home",
      date: dayAt(1, now),
      id: "next",
      kind: "thread",
      title: "Next",
    },
    {
      areaId: "home",
      date: dayAt(9, now),
      id: "far",
      kind: "thread",
      title: "Far",
    },
    { areaId: "home", id: "undated", kind: "thread", title: "Undated" },
  ];

  function planAt(clock: number) {
    const at = buildAxis(dated, clock, "compact");
    const { areaLanes } = buildLanes(dated, home, clock, at.days.length - 1);
    return { axis: at, lane: areaLanes[0] };
  }

  const ids = (bucket: PlanItem[] | undefined) =>
    bucket?.map((item) => item.id);

  it("re-places every item when the clock steps onto the next day", () => {
    const before = planAt(now);

    expect(before.axis.hasOverdue).toBe(false);
    expect(ids(before.lane.byDay.get("d0"))).toEqual(["today"]);
    expect(ids(before.lane.byDay.get("d1"))).toEqual(["next"]);
    expect(ids(before.lane.byDay.get("d9"))).toEqual(["far"]);
    expect(ids(before.lane.none)).toEqual(["undated"]);

    const after = planAt(tomorrow);

    // Yesterday's Today is a debt; the day behind it is the new Today.
    expect(after.axis.hasOverdue).toBe(true);
    expect(ids(after.lane.overdue)).toEqual(["today"]);
    expect(ids(after.lane.byDay.get("d0"))).toEqual(["next"]);

    // A future Thread keeps its exact calendar day, one slot nearer.
    expect(ids(after.lane.byDay.get("d8"))).toEqual(["far"]);
    expect(after.axis.days[8].at).toBe(dayAt(9, now));

    expect(ids(after.lane.none)).toEqual(["undated"]);
  });
});

describe("planDrop", () => {
  it("names the exact day a same-lane drop lands on", () => {
    const plan = drop({ overLaneId: "home", overSlotKey: "d4" });

    expect(plan).toMatchObject({
      areaMove: undefined,
      clears: false,
      reschedule: true,
      tone: "default",
      valid: true,
    });
    expect(plan!.date).toBe(dayAt(4, now));
    expect(plan!.caption).toMatch(/^\w{3} \d{1,2} \w{3}$/);
  });

  it("clears the date on the No-date bay", () => {
    const plan = drop({ overLaneId: "home", overSlotKey: "none" });

    expect(plan).toMatchObject({ clears: true, reschedule: true, valid: true });
    expect(plan!.date).toBeUndefined();
  });

  it("moves the Area when the drag crosses lanes, keeping the day", () => {
    const plan = drop({ overLaneId: "health", overSlotKey: "d2" });

    expect(plan).toMatchObject({
      areaMove: "health",
      reschedule: false,
      tone: "move",
      valid: true,
    });
  });

  it("refuses the past, the wrong lane, and a no-op drop", () => {
    expect(drop({ overLaneId: "home", overSlotKey: "overdue" })).toMatchObject({
      caption: "Can't plan into the past",
      valid: false,
    });
    expect(
      drop({ overLaneId: INBOX_LANE_ID, overSlotKey: "d3" }),
    ).toMatchObject({ caption: "Threads live in Areas", valid: false });
    expect(
      drop(
        { overLaneId: "home", overSlotKey: "d1" },
        { itemId: "k1", kind: "task", laneId: INBOX_LANE_ID, slotKey: "d1" },
      ),
    ).toMatchObject({ caption: "Tasks stay in the Inbox", valid: false });
    expect(drop({ overLaneId: "home", overSlotKey: "d2" })).toBeNull();
  });
});
