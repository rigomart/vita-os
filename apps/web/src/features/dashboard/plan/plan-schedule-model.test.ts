import { describe, expect, it } from "vitest";

import type { PlanItem } from "./plan-model";
import type { ScheduleRow } from "./plan-schedule-model";

import { dayAt, MAX_HORIZON, MIN_HORIZON, NEAR_DAYS } from "./plan-model";
import { buildSchedule, planScheduleDrop } from "./plan-schedule-model";

/** A Thursday in August, so the schedule crosses into September inside MIN. */
const now = new Date(2026, 7, 6, 9).getTime();

function item(fields: Partial<PlanItem> & { id: string }): PlanItem {
  return { kind: "thread", title: fields.id, ...fields };
}

const dayRows = (rows: ScheduleRow[]) =>
  rows.filter((row) => row.kind === "day").map((row) => row.offset);

const gapRows = (rows: ScheduleRow[]) =>
  rows
    .filter((row) => row.kind === "gap")
    .map((row) => [row.from, row.to] as const);

const monthRows = (rows: ScheduleRow[]) =>
  rows.filter((row) => row.kind === "month").map((row) => row.label);

describe("buildSchedule", () => {
  it("buckets by day and reads earliest first inside a day", () => {
    const schedule = buildSchedule(
      [
        item({ date: dayAt(2, now) + 6 * 60 * 60 * 1000, id: "afternoon" }),
        item({ date: dayAt(2, now), id: "morning" }),
        item({ date: dayAt(2, now), id: "also morning" }),
        item({ date: dayAt(-3, now), id: "late" }),
        item({ id: "undated" }),
      ],
      now,
    );

    expect(schedule.byDay.get("d2")?.map((entry) => entry.id)).toEqual([
      "also morning",
      "morning",
      "afternoon",
    ]);
    expect(schedule.overdue.map((entry) => entry.id)).toEqual(["late"]);
    expect(schedule.none.map((entry) => entry.id)).toEqual(["undated"]);
    expect(schedule.total).toBe(5);
  });

  it("prints every day of the near horizon, empty ones included", () => {
    const rows = buildSchedule(
      [item({ date: dayAt(3, now), id: "one" })],
      now,
    ).rows;

    expect(dayRows(rows).slice(0, NEAR_DAYS)).toEqual(
      Array.from({ length: NEAR_DAYS }, (_, offset) => offset),
    );
  });

  it("folds the quiet stretches past the near horizon into one row", () => {
    const rows = buildSchedule(
      [item({ date: dayAt(NEAR_DAYS + 5, now), id: "far" })],
      now,
    ).rows;

    expect(gapRows(rows)).toEqual([
      [NEAR_DAYS, NEAR_DAYS + 4],
      [NEAR_DAYS + 6, MIN_HORIZON],
    ]);
    expect(dayRows(rows)).toContain(NEAR_DAYS + 5);
  });

  it("keeps today on the list however empty the schedule is", () => {
    const rows = buildSchedule([], now).rows;

    expect(dayRows(rows)).toContain(0);
    expect(gapRows(rows)).toEqual([[NEAR_DAYS, MIN_HORIZON]]);
  });

  it("reaches the minimum horizon and stops at the maximum", () => {
    expect(dayRows(buildSchedule([], now).rows).at(-1)).toBe(NEAR_DAYS - 1);
    expect(gapRows(buildSchedule([], now).rows).at(-1)?.[1]).toBe(MIN_HORIZON);

    const mid = buildSchedule([item({ date: dayAt(50, now), id: "mid" })], now);
    expect(dayRows(mid.rows).at(-1)).toBe(50);
  });

  it("docks beyond-horizon items in the Later section, off the day rows", () => {
    const far = buildSchedule(
      [item({ date: dayAt(MAX_HORIZON + 40, now), id: "distant" })],
      now,
    );

    // A beyond-ceiling item no longer stretches the agenda or squats on the
    // last printed day — it sits in Later with its real date.
    expect(gapRows(far.rows).at(-1)?.[1]).toBe(MIN_HORIZON);
    expect(far.byDay.get(`d${MAX_HORIZON}`)).toBeUndefined();
    expect(far.beyond.map((entry) => entry.id)).toEqual(["distant"]);
    expect(far.total).toBe(1);
  });

  it("bands each month it reaches, the first one included", () => {
    // 26 days on from 6 August is 1 September, so the band lands on a printed
    // day rather than inside a folded gap.
    const rows = buildSchedule(
      [item({ date: dayAt(26, now), id: "september" })],
      now,
    ).rows;

    expect(monthRows(rows)).toEqual(["August 2026", "September 2026"]);
    expect(rows[0]).toMatchObject({ kind: "month", label: "August 2026" });
  });
});

describe("planScheduleDrop", () => {
  it("names the exact day a drop lands on", () => {
    const plan = planScheduleDrop("d2", "d4", now);

    expect(plan).toMatchObject({
      clears: false,
      reschedule: true,
      valid: true,
    });
    expect(plan!.date).toBe(dayAt(4, now));
    expect(plan!.caption).toMatch(/^\w{3} \d{1,2} \w{3}$/);
  });

  it("clears the date on the No-date section", () => {
    expect(planScheduleDrop("d2", "none", now)).toMatchObject({
      caption: "No date",
      clears: true,
      date: undefined,
      reschedule: true,
      valid: true,
    });
  });

  it("refuses the past", () => {
    expect(planScheduleDrop("d2", "overdue", now)).toMatchObject({
      caption: "Can't plan into the past",
      reschedule: false,
      valid: false,
    });
  });

  it("still names the day of a drop that changes nothing", () => {
    expect(planScheduleDrop("d2", "d2", now)).toMatchObject({
      reschedule: false,
      valid: true,
    });
    expect(planScheduleDrop("none", "none", now)).toMatchObject({
      reschedule: false,
    });
  });

  it("asks for a day on the Later section instead of writing one", () => {
    const plan = planScheduleDrop("d2", "beyond", now);

    expect(plan).toMatchObject({
      caption: "Pick a day",
      clears: false,
      needsDate: true,
      reschedule: true,
      valid: true,
    });
    expect(plan!.date).toBeUndefined();
  });

  it("writes the exact day a picker-shaped key names, however far", () => {
    expect(planScheduleDrop("d2", `d${MAX_HORIZON + 30}`, now)!.date).toBe(
      dayAt(MAX_HORIZON + 30, now),
    );
  });

  it("ignores a slot key no day answers to", () => {
    expect(planScheduleDrop("d2", "elsewhere", now)).toBeNull();
  });
});
