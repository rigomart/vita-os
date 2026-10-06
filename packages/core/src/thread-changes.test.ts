import type { AreaId, TaskId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { ThreadChangeState } from "./thread-changes";

import {
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
  decideAddNoteToThread,
  decideThreadUpdate,
  sanitizeThreadPatch,
  taskTextFromNote,
} from "./thread-changes";

function makeThread(
  overrides: Partial<ThreadChangeState> = {},
): ThreadChangeState {
  return {
    title: "Thread",
    slug: "thread-00000000",
    areaId: "area1" as AreaId,
    state: "open",
    ...overrides,
  };
}

const may20 = new Date("2026-05-20").getTime();

const callClinic = { _id: "task-1" as TaskId, text: "Call clinic" };
const bookSlot = { _id: "task-2" as TaskId, text: "Book slot" };
const jun1 = new Date("2026-06-01").getTime();

describe("sanitizeThreadPatch", () => {
  it("keeps only patchable fields, presence and all", () => {
    const patch = sanitizeThreadPatch({
      title: "New",
      focusedTaskId: undefined,
      id: "client-thread-id",
      key: "dashboard-row-key",
    } as never);

    expect(Object.keys(patch).sort()).toEqual(["focusedTaskId", "title"]);
    expect(patch).toEqual({ title: "New", focusedTaskId: undefined });
  });

  it("leaves a field absent when the caller never named it", () => {
    expect(sanitizeThreadPatch({ title: "New" })).not.toHaveProperty("tasks");
  });
});

describe("buildThreadPatchLogEntries", () => {
  it("writes nothing for Tasks changing, which are logged by their own rules", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), {
        tasks: [callClinic],
        focusedTaskId: callClinic._id,
      }),
    ).toEqual([]);
  });

  it("records a lifecycle change", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), { state: "resolved" }),
    ).toEqual([
      {
        type: "state_change",
        content: 'Lifecycle changed from "open" to "resolved"',
        previousValue: "open",
        newValue: "resolved",
      },
    ]);
  });

  it("writes no Follow-up entry: a Thread has no Follow-up date to change", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), { followUp: may20 } as never),
    ).toEqual([]);
  });

  it("records an Area task only when both Area names are known", () => {
    const patch = { areaId: "area2" as AreaId };

    expect(
      buildThreadPatchLogEntries(makeThread(), patch, {
        fromAreaName: "Health",
        toAreaName: "Home",
      }),
    ).toEqual([
      {
        type: "area_move",
        content: 'Moved from "Health" to "Home"',
        previousValue: "Health",
        newValue: "Home",
      },
    ]);
    expect(buildThreadPatchLogEntries(makeThread(), patch)).toEqual([]);
  });

  it("records labeling an unlabeled Thread", () => {
    expect(
      buildThreadPatchLogEntries(
        makeThread({ areaId: undefined }),
        { areaId: "area2" as AreaId },
        { toAreaName: "Home" },
      ),
    ).toEqual([
      { type: "area_move", content: 'Added to "Home"', newValue: "Home" },
    ]);
  });

  it("records removing a Thread's Area", () => {
    expect(
      buildThreadPatchLogEntries(
        makeThread(),
        { areaId: undefined },
        { fromAreaName: "Health" },
      ),
    ).toEqual([
      {
        type: "area_move",
        content: 'Removed from "Health"',
        previousValue: "Health",
      },
    ]);
  });

  it("records nothing when an unlabeled Thread stays unlabeled", () => {
    expect(
      buildThreadPatchLogEntries(makeThread({ areaId: undefined }), {
        areaId: undefined,
      }),
    ).toEqual([]);
  });
});

describe("buildThreadLifecyclePatch", () => {
  it("resolving clears the attention state and records the note", () => {
    expect(
      buildThreadLifecyclePatch(
        makeThread({
          tasks: [callClinic],
          focusedTaskId: callClinic._id,
        }),
        {
          state: "resolved",
          resolutionNote: "Clinic confirmed no further action",
        },
      ),
    ).toEqual({
      patch: {
        state: "resolved",
        tasks: undefined,
        focusedTaskId: undefined,
      },
      log: {
        type: "state_change",
        content:
          'Resolved thread: Clinic confirmed no further action — discarded tasks: "Call clinic"',
        previousValue: "open",
        newValue: "resolved",
      },
    });
  });

  it("names every Task a resolution discards, in capture order", () => {
    const change = buildThreadLifecyclePatch(
      makeThread({ tasks: [callClinic, bookSlot] }),
      { state: "resolved" },
    );

    expect(change?.log.content).toBe(
      'Resolved thread — discarded tasks: "Call clinic", "Book slot"',
    );
  });

  it("says nothing about Tasks when the Thread held none", () => {
    const change = buildThreadLifecyclePatch(makeThread(), {
      state: "resolved",
    });

    expect(change?.log.content).toBe("Resolved thread");
  });

  it("reopening restores nothing", () => {
    expect(
      buildThreadLifecyclePatch(makeThread({ state: "resolved" }), {
        state: "open",
      }),
    ).toEqual({
      patch: { state: "open" },
      log: {
        type: "state_change",
        content: "Reopened thread",
        previousValue: "resolved",
        newValue: "open",
      },
    });
  });

  it("is nothing at all when the state already matches", () => {
    expect(
      buildThreadLifecyclePatch(makeThread(), { state: "open" }),
    ).toBeNull();
  });
});

describe("decideThreadUpdate", () => {
  it("resolves, clears the attention state, and logs every field it cleared", () => {
    const decision = decideThreadUpdate({
      thread: makeThread({
        tasks: [callClinic, bookSlot],
        focusedTaskId: callClinic._id,
      }),
      patch: { state: "resolved" },
      resolutionNote: "Done for good",
    });

    expect(decision.patch).toEqual({
      state: "resolved",
      tasks: undefined,
      focusedTaskId: undefined,
    });
    expect(decision.logs).toEqual([
      {
        type: "state_change",
        content:
          'Resolved thread: Done for good — discarded tasks: "Call clinic", "Book slot"',
        previousValue: "open",
        newValue: "resolved",
      },
    ]);
  });

  it("names the dated Tasks a resolution discards, and logs nothing else", () => {
    const decision = decideThreadUpdate({
      thread: makeThread({
        tasks: [{ ...callClinic, date: may20 }, bookSlot],
      }),
      patch: { state: "resolved" },
    });

    expect(decision.logs.map((log) => log.content)).toEqual([
      'Resolved thread — discarded tasks: "Call clinic", "Book slot"',
    ]);
  });

  it("drops a Follow-up date from a Thread patch instead of writing it", () => {
    const decision = decideThreadUpdate({
      thread: makeThread(),
      patch: { followUp: may20 } as never,
    });

    expect(decision).toEqual({ patch: {}, logs: [] });
  });

  it("writes and logs nothing for a patch that names no change", () => {
    const decision = decideThreadUpdate({
      thread: makeThread(),
      patch: {},
    });

    expect(decision).toEqual({ patch: {}, logs: [] });
  });

  it("drops fields that are not the Thread's to change", () => {
    const decision = decideThreadUpdate({
      thread: makeThread(),
      patch: { title: "New", key: "dashboard-row-key" } as never,
    });

    expect(decision.patch).toEqual({ title: "New" });
  });
});

describe("decideAddNoteToThread", () => {
  const thread = makeThread({ tasks: [callClinic] });
  const newId = "task-new" as TaskId;

  it("adds no Task for an undated Note", () => {
    expect(
      decideAddNoteToThread(thread, { body: "Ask about parking" }, newId),
    ).toEqual({ patch: {}, logs: [] });
  });

  it("appends a dated Task from the Note's first line, time included, unfocused", () => {
    const afternoon = new Date("2026-05-20T15:30:00").getTime();
    const decision = decideAddNoteToThread(
      makeThread({
        tasks: [callClinic, bookSlot],
        focusedTaskId: bookSlot._id,
      }),
      { body: "\n  Bring the referral\nand the scan", followUp: afternoon },
      newId,
    );

    expect(decision.patch).toEqual({
      tasks: [
        callClinic,
        bookSlot,
        { _id: newId, text: "Bring the referral", date: afternoon },
      ],
    });
    expect(decision.patch).not.toHaveProperty("focusedTaskId");
    expect(decision.logs).toEqual([]);
  });

  it("starts a Task list on a Thread that held none, even for a date already past", () => {
    const past = new Date("2020-01-01T15:30:00").getTime();
    expect(
      decideAddNoteToThread(
        makeThread(),
        { body: "Old", followUp: past },
        newId,
      ).patch,
    ).toEqual({ tasks: [{ _id: newId, text: "Old", date: past }] });
  });

  it("keeps the Thread's own dated Tasks beside the new one", () => {
    const dated = { ...callClinic, date: may20 };
    const decision = decideAddNoteToThread(
      makeThread({ tasks: [dated] }),
      { body: "Later one", followUp: jun1 },
      newId,
    );

    expect(decision.patch.tasks).toEqual([
      dated,
      { _id: newId, text: "Later one", date: jun1 },
    ]);
  });
});

describe("taskTextFromNote", () => {
  it.each([
    ["Call the clinic", "Call the clinic"],
    ["  \n\n  Call the clinic  \nsecond line", "Call the clinic"],
    ["# Consultation\n[Clinic](https://example.com)", "Consultation"],
    ["## Plan", "Plan"],
    ["- Bring the scan", "Bring the scan"],
    ["* Bring the scan", "Bring the scan"],
    ["> A quote", "A quote"],
    [">tight quote", "tight quote"],
    ["1. First step", "First step"],
    ["12) Twelfth", "Twelfth"],
    ["> - nested item", "nested item"],
    ["**Bold** start", "**Bold** start"],
    ["#hashtag stays", "#hashtag stays"],
    ["3 pills a day", "3 pills a day"],
    ["#", "Follow up"],
    ["- ", "Follow up"],
    ["\n  \n", "Follow up"],
  ])("reads %j as %j", (body, expected) => {
    expect(taskTextFromNote(body)).toBe(expected);
  });
});
