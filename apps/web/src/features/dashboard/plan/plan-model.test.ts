import { describe, expect, it } from "vitest";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";

import type { DragState, PlanItem } from "./plan-model";

import {
  bayWidth,
  buildAxis,
  buildLanes,
  dayAt,
  HEADER_WIDTH,
  HEADER_WIDTH_NARROW,
  INBOX_LANE_ID,
  MAX_HORIZON,
  MIN_HORIZON,
  planDrop,
  slotKeyFor,
  slotTotals,
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

  it("files a date past the horizon into the Later rail, not the last day", () => {
    const horizon = axis.days.length - 1;
    expect(slotKeyFor(dayAt(horizon, now), now, horizon)).toBe(`d${horizon}`);
    expect(slotKeyFor(dayAt(horizon + 1, now), now, horizon)).toBe("beyond");
  });

  it("ends on its last day: neither Later nor No date earns a column", () => {
    const kinds = axis.columns.map((column) => column.kind);
    expect(kinds.at(-1)).toBe("day");
    expect(kinds).not.toContain("beyond");
    expect(kinds).not.toContain("none");
    // The waiting bay is the one column that is not a day.
    expect(kinds[0]).toBe("overdue");
  });

  it("bands every rendered day under its month, past the near region", () => {
    // Aug 6 2026 plus the 27-day floor lands in September, so the band has to
    // name both months and reach the last day column.
    const labels = axis.monthSpans.map((span) => span.label);
    expect(labels).toEqual(["August", "September"]);

    const lastDay = axis.columns
      .map((column) => column.kind)
      .lastIndexOf("day");
    expect(axis.monthSpans.at(-1)!.to).toBe(lastDay);
    expect(axis.monthSpans[0].from).toBe(axis.hasOverdue ? 1 : 0);
  });

  it("grows to the furthest rendered item, never for beyond-ceiling ones", () => {
    const within = buildAxis(
      [
        {
          areaId: "home",
          date: dayAt(50, now),
          id: "mid",
          kind: "thread",
          title: "Mid",
        },
      ],
      now,
      "compact",
    );
    expect(within.days.length - 1).toBe(50);

    const far = buildAxis(
      [
        {
          areaId: "home",
          date: dayAt(MAX_HORIZON + 40, now),
          id: "distant",
          kind: "thread",
          title: "Distant",
        },
      ],
      now,
      "compact",
    );
    // A beyond-ceiling item lives in the Later rail: it neither stretches the
    // axis nor widens the last rendered day.
    expect(far.days.length - 1).toBe(MIN_HORIZON);
    expect(far.days.at(-1)!.wide).toBe(false);
  });

  it("narrows the header column when the component layer asks for it", () => {
    const compact = buildAxis(items, now, "compact", HEADER_WIDTH_NARROW);

    expect(compact.template.startsWith(`${HEADER_WIDTH_NARROW}px `)).toBe(true);
    expect(axis.template.startsWith(`${HEADER_WIDTH}px `)).toBe(true);
    expect(axis.minWidth - compact.minWidth).toBe(
      HEADER_WIDTH - HEADER_WIDTH_NARROW,
    );
  });

  it("gives an open slot — and the waiting bay — the width its density asks for", () => {
    const comfortable = buildAxis(items, now, "comfortable");

    expect(axis.days.find((day) => day.wide)!.width).toBe(144);
    expect(comfortable.days.find((day) => day.wide)!.width).toBe(184);
    expect(bayWidth("compact")).toBe(144);
    expect(bayWidth("comfortable")).toBe(184);
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

  it("docks beyond-horizon items in the Later rail, dates intact", () => {
    const distant: PlanItem[] = [
      ...items,
      {
        areaId: "home",
        date: dayAt(MAX_HORIZON + 40, now),
        id: "t9",
        kind: "thread",
        title: "Distant thread",
      },
      {
        date: dayAt(MAX_HORIZON + 10, now),
        id: "k9",
        kind: "task",
        title: "Distant task",
      },
    ];
    const at = buildAxis(distant, now, "compact");
    const horizon = at.days.length - 1;
    const { areaLanes, inbox } = buildLanes(
      distant,
      [
        {
          condition: "healthy",
          icon: "Home",
          id: "home",
          name: "Home",
          order: 1,
          slug: "home",
        },
      ],
      now,
      horizon,
    );

    expect(areaLanes[0].beyond.map((item) => item.id)).toEqual(["t9"]);
    expect(inbox.beyond.map((item) => item.id)).toEqual(["k9"]);
    // The last rendered day stays honest: nothing is filed onto it.
    expect(areaLanes[0].byDay.get(`d${horizon}`)).toBeUndefined();
    expect(areaLanes[0].openCount).toBe(3);
    expect(slotTotals([...areaLanes, inbox]).beyond).toBe(2);
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

  it("asks for a day on the Later rail instead of writing one", () => {
    const plan = drop({ overLaneId: "home", overSlotKey: "beyond" });

    expect(plan).toMatchObject({
      caption: "Pick a day",
      clears: false,
      needsDate: true,
      reschedule: true,
      valid: true,
    });
    expect(plan!.date).toBeUndefined();
  });

  // A Later drop can no longer cross lanes: the rail sits beside the canvas
  // and publishes no lane, so `overLaneId` is always the source's.

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
