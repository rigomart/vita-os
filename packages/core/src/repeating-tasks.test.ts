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

  it.each([daily, { kind: "weekly", weekdays: [0, 1, 2] }] satisfies Repeat[])(
    "keeps Santiago date-only %j at each day's start across a midnight gap",
    (repeat) => {
      for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
        let current: rules.TaskState = thread("2026-09-05T00:00-04:00", repeat);
        for (const next of [
          "2026-09-06T01:00-03:00",
          "2026-09-07T00:00-03:00",
          "2026-09-08T00:00-03:00",
        ]) {
          const decision = command(current, id, {
            timeZone: "America/Santiago",
            now: current.tasks![0]!.date!,
          });
          expect(decision?.patch.tasks?.[0]?.date).toBe(ms(next));
          current = { ...current, ...decision!.patch };
        }
      }
    },
  );

  it("snaps a date-only weekly Task from Santiago's gap day back to midnight", () => {
    expect(
      rules.decideSetTaskRepeat(
        thread("2026-09-06T01:00-03:00"),
        id,
        { kind: "weekly", weekdays: [1] },
        "America/Santiago",
      )?.patch.tasks?.[0]?.date,
    ).toBe(ms("2026-09-07T00:00-03:00"));
  });

  it("keeps a timed Task's shifted New York wall time after a DST gap", () => {
    for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
      let current: rules.TaskState = thread("2026-03-07T02:30-05:00");
      for (const next of [
        "2026-03-08T03:30-04:00",
        "2026-03-09T03:30-04:00",
        "2026-03-10T03:30-04:00",
      ]) {
        const decision = command(current, id, {
          timeZone: "America/New_York",
          now: current.tasks![0]!.date!,
        });
        expect(decision?.patch.tasks?.[0]?.date).toBe(ms(next));
        current = { ...current, ...decision!.patch };
      }
    }
  });

  it.each([daily, { kind: "weekly", weekdays: [2] }] satisfies Repeat[])(
    "refuses a valid %j Repeat at capture even with a date",
    (repeat) => {
      expect(() =>
        rules.decideAddTask(
          { state: "open" },
          thread("2026-10-06T15:30Z", repeat).tasks[0]!,
        ),
      ).toThrow(ValidationError);
    },
  );

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
      rules.decideCompleteTask(thread("2026-10-06T15:30Z"), id, {
        timeZone: undefined,
        now: ms("2026-10-06"),
      }),
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
    { kind: "monthly", day: 0 },
    { kind: "monthly", day: 32 },
    { kind: "monthly", day: 1.5 },
    { kind: "monthly", day: "5" },
    { kind: "monthly", every: 1 },
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
      rules.decideSetTaskDate(
        original,
        id,
        ms("2026-03-07T15:30-05:00"),
        undefined,
      ),
    ).toThrow(ValidationError);
    expect(
      rules.decideSetTaskDate(
        original,
        id,
        ms("2026-03-07T15:30-05:00"),
        "America/New_York",
      )?.patch.tasks?.[0]?.date,
    ).toBe(ms("2026-03-08T15:30-04:00"));
    expect(
      rules.decideSetTaskDate(original, id, null, undefined)?.patch.tasks,
    ).toEqual([{ _id: id, text: "Check" }]);
    expect(
      rules.decideSetTaskRepeat(original, id, null, "UTC")?.patch.tasks?.[0],
    ).toEqual({ _id: id, text: "Check", date: original.tasks[0]?.date });
  });

  it("refuses skip on a one-off Task; one-off completion still needs no zone", () => {
    const original = {
      state: "open" as const,
      tasks: [{ _id: id, text: "Check" }],
    };
    expect(() =>
      rules.decideSkipTask(original, id, {
        timeZone: "UTC",
        now: ms("2026-10-06"),
      }),
    ).toThrow(ValidationError);
    expect(
      rules.decideCompleteTask(original, id, { timeZone: undefined, now: 0 })
        ?.patch,
    ).toEqual({ tasks: undefined });
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

  it("needs no zone for an unchanged daily date", () => {
    const original = thread("2026-10-06T15:30Z");
    expect(
      rules.decideSetTaskDate(
        original,
        id,
        original.tasks[0]!.date!,
        undefined,
      ),
    ).toEqual({ patch: {}, logs: [] });
    expect(
      rules.decideSetTaskDate(original, id, original.tasks[0]!.date!, "UTC"),
    ).toEqual({ patch: {}, logs: [] });
  });

  it.each([daily, { kind: "days", every: 3 }] satisfies Repeat[])(
    "changes an every-N-days date without a zone: %j",
    (repeat) => {
      const original = thread("2026-10-06T15:30Z", repeat);
      expect(
        rules.decideSetTaskDate(
          original,
          id,
          ms("2026-10-08T09:15Z"),
          undefined,
        ),
      ).toEqual({
        patch: {
          tasks: [{ ...original.tasks[0], date: ms("2026-10-08T09:15Z") }],
        },
        logs: [],
      });
    },
  );

  it.each([daily, { kind: "weekly", weekdays: [2] }] satisfies Repeat[])(
    "clears a %j Task's date and repeat without a zone",
    (repeat) => {
      expect(
        rules.decideSetTaskDate(
          thread("2026-10-06T15:30Z", repeat),
          id,
          null,
          undefined,
        ),
      ).toEqual({ patch: { tasks: [{ _id: id, text: "Check" }] }, logs: [] });
    },
  );

  it("validates a supplied zone even when changing the date needs none", () => {
    for (const date of [
      null,
      ms("2026-10-08T09:15Z"),
      ms("2026-10-06T15:30Z"),
    ]) {
      expect(() =>
        rules.decideSetTaskDate(
          thread("2026-10-06T15:30Z"),
          id,
          date,
          "Invalid/Zone",
        ),
      ).toThrow(ValidationError);
    }
  });

  it("still requires a zone to set a weekly repeat and to complete or skip repeats", () => {
    const original = thread("2026-10-06T15:30Z");
    // A caller without a zone does not compile; a request without one is
    // still refused at run time.
    const noZone = undefined as unknown as string;
    expect(() =>
      rules.decideSetTaskRepeat(
        original,
        id,
        { kind: "weekly", weekdays: [2] },
        noZone,
      ),
    ).toThrow(ValidationError);
    for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
      expect(() =>
        command(original, id, { timeZone: noZone, now: ms("2026-10-06") }),
      ).toThrow(ValidationError);
    }
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

describe("monthly Repeats", () => {
  const monthly = (day: number): Repeat => ({ kind: "monthly", day });
  /** Complete each occurrence on its own day, as a person keeping up would. */
  function occurrences(
    date: string,
    repeat: Repeat,
    count: number,
    timeZone = "UTC",
  ) {
    let current: rules.TaskState = thread(date, repeat);
    const dates: number[] = [];
    for (let i = 0; i < count; i++) {
      const decision = rules.decideCompleteTask(current, id, {
        timeZone,
        now: current.tasks![0]!.date!,
      });
      current = { ...current, ...decision!.patch };
      dates.push(current.tasks![0]!.date!);
    }
    return dates;
  }

  it("falls to a short month's last day and returns to the chosen day", () => {
    expect(occurrences("2027-01-31T09:15Z", monthly(31), 4)).toEqual(
      ["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"].map((day) =>
        ms(`${day}T09:15Z`),
      ),
    );
    expect(occurrences("2026-12-30T09:15Z", monthly(30), 3)).toEqual(
      ["2027-01-30", "2027-02-28", "2027-03-30"].map((day) =>
        ms(`${day}T09:15Z`),
      ),
    );
  });

  it("lands on Feb 29 in a leap year", () => {
    expect(occurrences("2028-01-31T00:00Z", monthly(31), 2)).toEqual([
      ms("2028-02-29T00:00Z"),
      ms("2028-03-31T00:00Z"),
    ]);
    expect(occurrences("2028-01-29T00:00Z", monthly(29), 2)).toEqual([
      ms("2028-02-29T00:00Z"),
      ms("2028-03-29T00:00Z"),
    ]);
  });

  it.each([
    ["2026-11-05T12:00Z", "2026-12-05T15:30Z"],
    ["2026-11-09T12:00Z", "2026-12-05T15:30Z"],
    ["2027-02-10T12:00Z", "2027-03-05T15:30Z"],
    ["2027-02-05T23:00Z", "2027-02-05T15:30Z"],
    ["2027-02-04T12:00Z", "2027-02-05T15:30Z"],
  ])("collapses missed occurrences: completed at %s, next %s", (now, next) => {
    for (const command of [rules.decideCompleteTask, rules.decideSkipTask]) {
      const decision = command(thread("2026-11-05T15:30Z", monthly(5)), id, {
        timeZone: "UTC",
        now: ms(now),
      });
      expect(decision?.patch.tasks?.[0]?.date).toBe(ms(next));
    }
  });

  it.each([
    [
      "America/New_York",
      "2026-02-10T09:00-05:00",
      ["2026-03-10T09:00-04:00", "2026-04-10T09:00-04:00"],
    ],
    [
      "America/New_York",
      "2026-10-31T00:00-04:00",
      ["2026-11-30T00:00-05:00", "2026-12-31T00:00-05:00"],
    ],
    [
      "Europe/Berlin",
      "2026-09-25T02:30+02:00",
      ["2026-10-25T02:30+02:00", "2026-11-25T02:30+01:00"],
    ],
    [
      "America/Santiago",
      "2026-08-06T00:00-04:00",
      ["2026-09-06T01:00-03:00", "2026-10-06T00:00-03:00"],
    ],
  ])("keeps local time across DST in %s from %s", (timeZone, date, next) => {
    const day = Number(date.slice(8, 10));
    expect(occurrences(date, monthly(day), 2, timeZone)).toEqual(next.map(ms));
  });

  it("uses the caller's day near midnight", () => {
    // Jan 31 in Auckland is still Jan 30 in UTC.
    const decision = rules.decideCompleteTask(
      thread("2027-01-31T09:00+13:00", monthly(31)),
      id,
      { timeZone: "Pacific/Auckland", now: ms("2027-01-31T09:00+13:00") },
    );
    expect(decision?.patch.tasks?.[0]?.date).toBe(ms("2027-02-28T09:00+13:00"));
  });

  it.each([
    ["2026-03-12T15:30Z", 12, "2026-03-12T15:30Z"],
    ["2026-03-05T15:30Z", 12, "2026-03-12T15:30Z"],
    ["2026-03-15T15:30Z", 12, "2026-04-12T15:30Z"],
    ["2027-02-28T15:30Z", 31, "2027-02-28T15:30Z"],
    ["2026-04-30T15:30Z", 31, "2026-04-30T15:30Z"],
  ])(
    "sets a Repeat on %s monthly on day %i, snapping to %s",
    (date, day, snapped) => {
      const original = thread(date, daily);
      const decision = rules.decideSetTaskRepeat(
        original,
        id,
        monthly(day),
        "UTC",
      );
      expect(decision?.patch.tasks?.[0]).toEqual({
        ...original.tasks[0],
        date: ms(snapped),
        repeat: monthly(day),
      });
    },
  );

  it("moves the Repeat to a changed date's day, in the caller's zone", () => {
    const original = thread("2026-12-05T15:30Z", monthly(5));
    expect(() =>
      rules.decideSetTaskDate(original, id, ms("2026-12-12T15:30Z"), undefined),
    ).toThrow(ValidationError);
    const moved = rules.decideSetTaskDate(
      original,
      id,
      ms("2026-12-12T15:30Z"),
      "UTC",
    );
    expect(moved?.patch.tasks?.[0]).toEqual({
      ...original.tasks[0],
      date: ms("2026-12-12T15:30Z"),
      repeat: monthly(12),
    });
    expect(
      rules.decideCompleteTask({ ...original, ...moved!.patch }, id, {
        timeZone: "UTC",
        now: ms("2026-12-12T16:00Z"),
      })?.patch.tasks?.[0]?.date,
    ).toBe(ms("2027-01-12T15:30Z"));
    // 02:00 UTC on Dec 12 is still Dec 11 in New York.
    expect(
      rules.decideSetTaskDate(
        original,
        id,
        ms("2026-12-12T02:00Z"),
        "America/New_York",
      )?.patch.tasks?.[0]?.repeat,
    ).toEqual(monthly(11));
  });

  it("keeps the chosen day when only the time changes, and clears it with the date", () => {
    const original = thread("2027-02-28T09:00Z", monthly(31));
    expect(
      rules.decideSetTaskDate(original, id, ms("2027-02-28T10:00Z"), "UTC")
        ?.patch.tasks?.[0],
    ).toEqual({
      ...original.tasks[0],
      date: ms("2027-02-28T10:00Z"),
      repeat: monthly(31),
    });
    expect(
      rules.decideSetTaskDate(
        original,
        id,
        original.tasks[0]!.date!,
        undefined,
      ),
    ).toEqual({ patch: {}, logs: [] });
    expect(
      rules.decideSetTaskDate(original, id, null, undefined)?.patch.tasks,
    ).toEqual([{ _id: id, text: "Check" }]);
  });

  it("accepts days 1 through 31", () => {
    expect(rules.requireRepeat(monthly(1))).toEqual(monthly(1));
    expect(rules.requireRepeat({ ...monthly(31), extra: true })).toEqual(
      monthly(31),
    );
  });
});
