import type { Task, TaskId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { ConflictError, ValidationError } from "./errors";
import { decideSetTaskDate, taskSlot } from "./tasks";

const task = (id: string, fields: Partial<Task> = {}): Task => ({
  _id: id as TaskId,
  text: `Task ${id}`,
  ...fields,
});

const day = (date: number, hours = 0, minutes = 0) =>
  new Date(2026, 9, date, hours, minutes).getTime();

describe("setting a Task's date", () => {
  it("sets the date on one Task and leaves the others alone", () => {
    const decision = decideSetTaskDate(
      { state: "open", tasks: [task("a"), task("b")] },
      "b" as TaskId,
      day(8, 15, 30),
    );

    expect(decision?.patch.tasks).toEqual([
      task("a"),
      task("b", { date: day(8, 15, 30) }),
    ]);
    expect(decision?.logs).toEqual([]);
  });

  it("changes a date and clears it, writing no Activity Log entry", () => {
    const thread = {
      state: "open" as const,
      tasks: [task("a", { date: day(8) })],
    };

    const changed = decideSetTaskDate(thread, "a" as TaskId, day(9));
    expect(changed?.patch.tasks).toEqual([task("a", { date: day(9) })]);
    expect(changed?.logs).toEqual([]);

    const cleared = decideSetTaskDate(thread, "a" as TaskId, null);
    expect(cleared?.patch.tasks).toEqual([task("a")]);
    expect(cleared?.patch.tasks?.[0]).not.toHaveProperty("date");
    expect(cleared?.logs).toEqual([]);
  });

  it("changes nothing when the date is already what was asked", () => {
    const thread = {
      state: "open" as const,
      tasks: [task("a", { date: day(8) }), task("b")],
    };

    expect(decideSetTaskDate(thread, "a" as TaskId, day(8))).toEqual({
      patch: {},
      logs: [],
    });
    expect(decideSetTaskDate(thread, "b" as TaskId, null)).toEqual({
      patch: {},
      logs: [],
    });
  });

  it("answers null for a Task the Thread does not hold", () => {
    expect(
      decideSetTaskDate({ state: "open" }, "a" as TaskId, day(8)),
    ).toBeNull();
  });

  it("refuses a resolved Thread and a date no row could hold", () => {
    expect(() =>
      decideSetTaskDate({ state: "resolved" }, "a" as TaskId, day(8)),
    ).toThrow(ConflictError);
    expect(() =>
      decideSetTaskDate(
        { state: "open", tasks: [task("a")] },
        "a" as TaskId,
        1.5,
      ),
    ).toThrow(ValidationError);
  });
});

describe("the Task slot of a card", () => {
  it("is empty without Tasks", () => {
    expect(taskSlot({})).toEqual({ kind: "none" });
  });

  it("leads with the dated Task that placed the Thread, even when another is focused", () => {
    const slot = taskSlot({
      tasks: [
        task("a"),
        task("b", { date: day(9) }),
        task("c", { date: day(8) }),
      ],
      focusedTaskId: "a" as TaskId,
    });

    expect(slot).toMatchObject({ kind: "task", focused: false });
    expect(slot.kind === "task" && slot.task._id).toBe("c");
  });

  it("never picks between two dated Tasks on the same day", () => {
    expect(
      taskSlot({
        tasks: [
          task("a", { date: day(8, 15) }),
          task("b", { date: day(8) }),
          task("c", { date: day(10) }),
        ],
      }),
    ).toEqual({ kind: "sameDay", count: 2, date: day(8) });
  });

  it("keeps today's rule when no Task is dated", () => {
    const only = taskSlot({ tasks: [task("a")] });
    expect(only).toMatchObject({ kind: "task", focused: false });

    const focused = taskSlot({
      tasks: [task("a"), task("b")],
      focusedTaskId: "b" as TaskId,
    });
    expect(focused.kind === "task" && focused.task._id).toBe("b");
    expect(focused).toMatchObject({ focused: true });

    expect(taskSlot({ tasks: [task("a"), task("b")] })).toEqual({
      kind: "unfocused",
      count: 2,
    });
  });
});
