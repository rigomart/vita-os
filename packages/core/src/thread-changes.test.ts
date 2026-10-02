import type { AreaId, MoveId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { ThreadChangeState } from "./thread-changes";

import {
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
  decideThreadUpdate,
  sanitizeThreadPatch,
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

const callClinic = { _id: "move-1" as MoveId, text: "Call clinic" };
const bookSlot = { _id: "move-2" as MoveId, text: "Book slot" };
const jun1 = new Date("2026-06-01").getTime();

describe("sanitizeThreadPatch", () => {
  it("keeps only patchable fields, presence and all", () => {
    const patch = sanitizeThreadPatch({
      title: "New",
      focusedMoveId: undefined,
      id: "client-thread-id",
      key: "dashboard-row-key",
    } as never);

    expect(Object.keys(patch).sort()).toEqual(["focusedMoveId", "title"]);
    expect(patch).toEqual({ title: "New", focusedMoveId: undefined });
  });

  it("leaves a field absent when the caller never named it", () => {
    expect(sanitizeThreadPatch({ title: "New" })).not.toHaveProperty("moves");
  });
});

describe("buildThreadPatchLogEntries", () => {
  it("writes nothing for Moves changing, which are logged by their own rules", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), {
        moves: [callClinic],
        focusedMoveId: callClinic._id,
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

  it("keeps Follow-up timestamps for the reader's time zone to write", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), { followUp: may20 }),
    ).toEqual([
      {
        type: "follow_up_change",
        content: "Follow-up set",
        previousValue: undefined,
        newValue: String(may20),
      },
    ]);

    expect(
      buildThreadPatchLogEntries(makeThread({ followUp: may20 }), {
        followUp: jun1,
      }),
    ).toEqual([
      {
        type: "follow_up_change",
        content: "Follow-up changed",
        previousValue: String(may20),
        newValue: String(jun1),
      },
    ]);

    expect(
      buildThreadPatchLogEntries(makeThread({ followUp: may20 }), {
        followUp: undefined,
      }),
    ).toEqual([
      {
        type: "follow_up_change",
        content: "Follow-up cleared",
        previousValue: String(may20),
        newValue: undefined,
      },
    ]);

    expect(
      buildThreadPatchLogEntries(makeThread({ followUp: may20 }), {
        followUp: may20,
      }),
    ).toEqual([]);
  });

  it("records an Area move only when both Area names are known", () => {
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
          moves: [callClinic],
          focusedMoveId: callClinic._id,
          followUp: may20,
        }),
        {
          state: "resolved",
          resolutionNote: "Clinic confirmed no further action",
        },
      ),
    ).toEqual({
      patch: {
        state: "resolved",
        moves: undefined,
        focusedMoveId: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content:
          'Resolved thread: Clinic confirmed no further action — discarded moves: "Call clinic"',
        previousValue: "open",
        newValue: "resolved",
      },
    });
  });

  it("names every Move a resolution discards, in capture order", () => {
    const change = buildThreadLifecyclePatch(
      makeThread({ moves: [callClinic, bookSlot] }),
      { state: "resolved" },
    );

    expect(change?.log.content).toBe(
      'Resolved thread — discarded moves: "Call clinic", "Book slot"',
    );
  });

  it("says nothing about Moves when the Thread held none", () => {
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
        moves: [callClinic, bookSlot],
        focusedMoveId: callClinic._id,
        followUp: may20,
      }),
      patch: { state: "resolved" },
      resolutionNote: "Done for good",
    });

    expect(decision.patch).toEqual({
      state: "resolved",
      moves: undefined,
      focusedMoveId: undefined,
      followUp: undefined,
    });
    expect(decision.logs).toEqual([
      {
        type: "state_change",
        content:
          'Resolved thread: Done for good — discarded moves: "Call clinic", "Book slot"',
        previousValue: "open",
        newValue: "resolved",
      },
      {
        type: "follow_up_change",
        content: "Follow-up cleared",
        previousValue: String(may20),
        newValue: undefined,
      },
    ]);
  });

  it("logs an Area move and a Follow-up change in order", () => {
    const decision = decideThreadUpdate({
      thread: makeThread(),
      patch: { areaId: "area2" as AreaId, followUp: may20 },
      areaNames: { from: "Health", to: "Home" },
    });

    expect(decision.logs.map((log) => log.type)).toEqual([
      "area_move",
      "follow_up_change",
    ]);
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
