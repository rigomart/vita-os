import type { Repeat, Task, TaskId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { ValidationError } from "./errors";
import * as rules from "./tasks";

const id = "a" as TaskId;
const ms = (iso: string) => Date.parse(iso);
const daily: Repeat = { kind: "days", every: 1 };
const thread = (date: string | undefined, repeat: Repeat = daily) => ({
  state: "open" as const,
  tasks: [
    { _id: id, text: "Check", ...(date ? { date: ms(date) } : {}), repeat },
  ],
  focusedTaskId: id,
});

describe("repeating Tasks", () => {
  it.each([
    [daily, "2026-10-06T20:00Z", "2026-10-07T15:30Z"],
    [daily, "2026-10-07T20:00Z", "2026-10-07T15:30Z"],
    [daily, "2026-10-10T20:00Z", "2026-10-10T15:30Z"],
    [{ kind: "days", every: 3 }, "2026-10-06T20:00Z", "2026-10-09T15:30Z"],
    [{ kind: "days", every: 3 }, "2026-10-10T20:00Z", "2026-10-12T15:30Z"],
    [{ kind: "days", every: 3 }, "2026-10-20T20:00Z", "2026-10-21T15:30Z"],
    [
      { kind: "weekly", weekdays: [2, 4] },
      "2026-10-06T20:00Z",
      "2026-10-08T15:30Z",
    ],
    [
      { kind: "weekly", weekdays: [2, 4] },
      "2026-10-09T20:00Z",
      "2026-10-13T15:30Z",
    ],
    [
      { kind: "weekly", weekdays: [2, 4] },
      "2026-10-21T20:00Z",
      "2026-10-22T15:30Z",
    ],
  ] satisfies [Repeat, string, string][])(
    "advances %j at %s to %s, collapsing missed dates",
    (repeat, now, next) => {
      const original = thread("2026-10-06T15:30Z", repeat);
      for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
        const decision = command(original, id, {
          timeZone: "UTC",
          now: ms(now),
        });
        expect(decision?.patch.tasks).toEqual([
          { ...original.tasks[0], date: ms(next) },
        ]);
        expect(decision?.patch).not.toHaveProperty("focusedTaskId");
        expect(decision?.logs).toHaveLength(
          command === rules.decideCompleteTask ? 1 : 0,
        );
      }
      expect(original.tasks[0]?.date).toBe(ms("2026-10-06T15:30Z"));
    },
  );

  it.each([
    [
      "America/New_York",
      "2026-03-07T15:30:12.345-05:00",
      "2026-03-08T15:30:12.345-04:00",
    ],
    ["America/New_York", "2026-10-31T15:30-04:00", "2026-11-01T15:30-05:00"],
    ["Europe/Berlin", "2026-03-28T15:30+01:00", "2026-03-29T15:30+02:00"],
    ["Europe/Berlin", "2026-10-24T15:30+02:00", "2026-10-25T15:30+01:00"],
    ["America/New_York", "2026-03-07T02:30-05:00", "2026-03-08T03:30-04:00"],
    ["America/New_York", "2026-10-31T01:30-04:00", "2026-11-01T01:30-04:00"],
    ["Europe/Berlin", "2026-03-28T02:30+01:00", "2026-03-29T03:30+02:00"],
    ["Europe/Berlin", "2026-10-24T02:30+02:00", "2026-10-25T02:30+02:00"],
    ["America/New_York", "2026-03-08T00:00-05:00", "2026-03-09T00:00-04:00"],
    ["America/New_York", "2026-11-01T00:00-04:00", "2026-11-02T00:00-05:00"],
    ["Europe/Berlin", "2026-03-29T00:00+01:00", "2026-03-30T00:00+02:00"],
    ["Europe/Berlin", "2026-10-25T00:00+02:00", "2026-10-26T00:00+01:00"],
    ["Pacific/Auckland", "2026-09-26T23:55+12:00", "2026-09-27T23:55+13:00"],
    ["Pacific/Auckland", "2026-09-27T00:00+12:00", "2026-09-28T00:00+13:00"],
  ])(
    "keeps local time and date-only values across DST in %s",
    (timeZone, date, next) => {
      for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
        const decision = command(thread(date), id, { timeZone, now: ms(date) });
        expect(decision?.patch.tasks?.[0]?.date).toBe(ms(next));
      }
    },
  );

  it("uses today in the caller's zone near midnight, even before the Task's time", () => {
    const decision = rules.decideCompleteTask(
      thread("2026-10-01T23:55+13:00"),
      id,
      {
        timeZone: "Pacific/Auckland",
        now: ms("2026-10-06T00:05+13:00"),
      },
    );
    expect(decision?.patch.tasks?.[0]?.date).toBe(ms("2026-10-06T23:55+13:00"));
  });

  it("requires a date and a valid zone, never silently removing a repeating Task", () => {
    expect(() =>
      rules.decideSetTaskRepeat(
        { state: "open", tasks: [{ _id: id, text: "Check" }] },
        id,
        daily,
        "UTC",
      ),
    ).toThrow(ValidationError);
    expect(() =>
      rules.decideCompleteTask(thread("2026-10-06T15:30Z"), id),
    ).toThrow(ValidationError);
    expect(() =>
      rules.decideCompleteTask(thread("2026-10-06T15:30Z"), id, {
        now: ms("2026-10-06"),
        timeZone: "Invalid/Zone",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      rules.decideCompleteTask(thread(undefined), id, {
        now: ms("2026-10-06"),
        timeZone: "UTC",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      rules.decideSetTaskRepeat(
        thread("2026-10-06T15:30Z"),
        id,
        null,
        "Invalid/Zone",
      ),
    ).toThrow(ValidationError);
  });

  it.each([
    { kind: "days", every: 0 },
    { kind: "days", every: -1 },
    { kind: "days", every: 366 },
    { kind: "days", every: 1.5 },
    { kind: "days", every: Number.NaN },
    { kind: "weekly", weekdays: [] },
    { kind: "weekly", weekdays: [1, 1] },
    { kind: "weekly", weekdays: [-1] },
    { kind: "weekly", weekdays: [7] },
    { kind: "weekly", weekdays: [1.5] },
    { kind: "monthly" },
    null,
  ])("refuses malformed Repeat %j in core", (repeat) => {
    expect(() => rules.requireRepeat(repeat)).toThrow(ValidationError);
    expect(() =>
      rules.decideAddTask({ state: "open" }, {
        _id: id,
        text: "Check",
        date: ms("2026-10-06"),
        repeat,
      } as Task),
    ).toThrow(ValidationError);
  });

  it("accepts the bounds, sorts weekly days, and refuses a Repeat on an undated added Task", () => {
    expect(rules.requireRepeat({ kind: "days", every: 365 })).toEqual({
      kind: "days",
      every: 365,
    });
    expect(
      rules.requireRepeat({ kind: "weekly", weekdays: [6, 0, 2] }),
    ).toEqual({ kind: "weekly", weekdays: [0, 2, 6] });
    expect(() =>
      rules.decideAddTask({ state: "open" }, thread(undefined).tasks[0]!),
    ).toThrow(ValidationError);
  });

  it("sets weekly Repeat sorted, snapping forward or keeping a chosen day and local time", () => {
    const original = thread("2026-03-07T15:30-05:00");
    const decision = rules.decideSetTaskRepeat(
      original,
      id,
      { kind: "weekly", weekdays: [3, 0] },
      "America/New_York",
    );
    expect(decision?.patch.tasks?.[0]).toEqual({
      ...original.tasks[0],
      date: ms("2026-03-08T15:30-04:00"),
      repeat: { kind: "weekly", weekdays: [0, 3] },
    });
    expect(decision?.logs).toEqual([]);
    expect(
      rules.decideSetTaskRepeat(
        { ...original, tasks: decision!.patch.tasks },
        id,
        { kind: "weekly", weekdays: [0, 3] },
        "America/New_York",
      ),
    ).toEqual({ patch: {}, logs: [] });
  });

  it("snaps a weekly Task's new date, requires its zone, and clears Repeat with the date", () => {
    const original = thread("2026-03-06T15:30-05:00", {
      kind: "weekly",
      weekdays: [0],
    });
    expect(() =>
      rules.decideSetTaskDate(original, id, ms("2026-03-07T15:30-05:00")),
    ).toThrow(ValidationError);
    expect(
      rules.decideSetTaskDate(
        original,
        id,
        ms("2026-03-07T15:30-05:00"),
        "America/New_York",
      )?.patch.tasks?.[0]?.date,
    ).toBe(ms("2026-03-08T15:30-04:00"));
    expect(() => rules.decideSetTaskDate(original, id, null)).toThrow(
      ValidationError,
    );
    expect(
      rules.decideSetTaskDate(original, id, null, "UTC")?.patch.tasks,
    ).toEqual([{ _id: id, text: "Check" }]);
    expect(
      rules.decideSetTaskRepeat(original, id, null, "UTC")?.patch.tasks?.[0],
    ).toEqual({ _id: id, text: "Check", date: original.tasks[0]?.date });
  });

  it("refuses skip on a one-off Task; one-off completion still needs no zone", () => {
    const original = {
      state: "open" as const,
      tasks: [{ _id: id, text: "Check" }],
      focusedTaskId: id,
    };
    expect(() =>
      rules.decideSkipTask(original, id, {
        timeZone: "UTC",
        now: ms("2026-10-06"),
      }),
    ).toThrow(ValidationError);
    expect(rules.decideCompleteTask(original, id)?.patch).toEqual({
      tasks: undefined,
      focusedTaskId: undefined,
    });
    expect(
      rules.decideSkipTask(original, "missing" as TaskId, {
        timeZone: "UTC",
        now: ms("2026-10-06"),
      }),
    ).toBeNull();
    expect(
      rules.decideSetTaskRepeat(original, "missing" as TaskId, daily, "UTC"),
    ).toBeNull();
  });

  it("refuses a next date beyond the stored range", () => {
    expect(() =>
      rules.decideCompleteTask(thread("9999-12-31T12:00Z"), id, {
        timeZone: "UTC",
        now: ms("2026-10-06"),
      }),
    ).toThrow(ValidationError);
  });

  it("requires a zone even for an unchanged daily date", () => {
    const original = thread("2026-10-06T15:30Z");
    expect(() =>
      rules.decideSetTaskDate(original, id, original.tasks[0]!.date!),
    ).toThrow(ValidationError);
    expect(
      rules.decideSetTaskDate(original, id, original.tasks[0]!.date!, "UTC"),
    ).toEqual({ patch: {}, logs: [] });
  });

  it.each([
    ["2028-02-28T09:15Z", "2028-02-29T09:15Z"],
    ["2026-12-31T09:15Z", "2027-01-01T09:15Z"],
  ])("crosses calendar boundaries from %s", (date, next) => {
    expect(
      rules.decideCompleteTask(thread(date), id, {
        timeZone: "UTC",
        now: ms(date),
      })?.patch.tasks?.[0]?.date,
    ).toBe(ms(next));
  });

  it("snaps weekly midnight and a missing wall time across DST", () => {
    for (const [date, next] of [
      ["2026-03-07T00:00-05:00", "2026-03-08T00:00-05:00"],
      ["2026-03-07T02:30-05:00", "2026-03-08T03:30-04:00"],
    ]) {
      expect(
        rules.decideSetTaskRepeat(
          thread(date),
          id,
          { kind: "weekly", weekdays: [0] },
          "America/New_York",
        )?.patch.tasks?.[0]?.date,
      ).toBe(ms(next!));
    }
  });
});
