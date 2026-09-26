import type { AreaId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { ThreadChangeState } from "./thread-changes";

import {
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
  decideThreadUpdate,
  fillNextMoveFromUpNext,
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
const jun1 = new Date("2026-06-01").getTime();

describe("sanitizeThreadPatch", () => {
  it("keeps only patchable fields, presence and all", () => {
    const patch = sanitizeThreadPatch({
      title: "New",
      nextMove: undefined,
      id: "client-thread-id",
      key: "dashboard-row-key",
    } as never);

    expect(Object.keys(patch).sort()).toEqual(["nextMove", "title"]);
    expect(patch).toEqual({ title: "New", nextMove: undefined });
  });

  it("leaves a field absent when the caller never named it", () => {
    expect(sanitizeThreadPatch({ title: "New" })).not.toHaveProperty(
      "nextMove",
    );
  });
});

describe("fillNextMoveFromUpNext", () => {
  it("promotes the front move when a write would empty the slot", () => {
    const thread = makeThread({
      nextMove: "Call clinic",
      upNext: ["Book slot", "Pay bill"],
    });

    expect(fillNextMoveFromUpNext(thread, { nextMove: undefined })).toEqual({
      nextMove: "Book slot",
      upNext: ["Pay bill"],
    });
  });

  it("leaves the last promotion with no Up Next at all", () => {
    const thread = makeThread({
      nextMove: "Call clinic",
      upNext: ["Book slot"],
    });

    expect(fillNextMoveFromUpNext(thread, { nextMove: undefined })).toEqual({
      nextMove: "Book slot",
      upNext: undefined,
    });
  });

  it("leaves a filled slot alone", () => {
    const thread = makeThread({
      nextMove: "Call clinic",
      upNext: ["Book slot"],
    });

    expect(fillNextMoveFromUpNext(thread, { title: "New" })).toEqual({
      title: "New",
    });
  });

  it("promotes from the moves the same write is storing", () => {
    const thread = makeThread();

    expect(fillNextMoveFromUpNext(thread, { upNext: ["Book slot"] })).toEqual({
      nextMove: "Book slot",
      upNext: undefined,
    });
  });
});

describe("buildThreadPatchLogEntries", () => {
  it("logs setting a Next Move from empty", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), { nextMove: "Call clinic" }),
    ).toEqual([
      {
        type: "next_move_change",
        content: 'Next move set to "Call clinic"',
        previousValue: undefined,
        newValue: "Call clinic",
      },
    ]);
  });

  it("logs changing an existing Next Move", () => {
    expect(
      buildThreadPatchLogEntries(makeThread({ nextMove: "Call clinic" }), {
        nextMove: "Book checkup",
      }),
    ).toEqual([
      {
        type: "next_move_change",
        content: 'Next move changed from "Call clinic" to "Book checkup"',
        previousValue: "Call clinic",
        newValue: "Book checkup",
      },
    ]);
  });

  it("logs clearing a Next Move", () => {
    expect(
      buildThreadPatchLogEntries(makeThread({ nextMove: "Call clinic" }), {
        nextMove: undefined,
      }),
    ).toEqual([
      {
        type: "next_move_change",
        content: "Next move cleared",
        previousValue: "Call clinic",
        newValue: undefined,
      },
    ]);
  });

  it("stays silent when the Next Move does not change", () => {
    expect(
      buildThreadPatchLogEntries(makeThread({ nextMove: "Call clinic" }), {
        nextMove: "Call clinic",
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

  it("formats Follow-up dates in UTC", () => {
    expect(
      buildThreadPatchLogEntries(makeThread(), { followUp: may20 }),
    ).toEqual([
      {
        type: "follow_up_change",
        content: 'Follow-up set to "May 20, 2026"',
        previousValue: undefined,
        newValue: "May 20, 2026",
      },
    ]);

    expect(
      buildThreadPatchLogEntries(makeThread({ followUp: may20 }), {
        followUp: jun1,
      }),
    ).toEqual([
      {
        type: "follow_up_change",
        content: 'Follow-up changed from "May 20, 2026" to "Jun 1, 2026"',
        previousValue: "May 20, 2026",
        newValue: "Jun 1, 2026",
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
        previousValue: "May 20, 2026",
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
        makeThread({ nextMove: "Call clinic", followUp: may20 }),
        {
          state: "resolved",
          resolutionNote: "Clinic confirmed no further action",
        },
      ),
    ).toEqual({
      patch: {
        state: "resolved",
        nextMove: undefined,
        upNext: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: "Resolved thread: Clinic confirmed no further action",
        previousValue: "open",
        newValue: "resolved",
      },
    });
  });

  it("names the upcoming moves a resolution discards", () => {
    const change = buildThreadLifecyclePatch(
      makeThread({
        nextMove: "Call clinic",
        upNext: ["Book slot", "Pay bill"],
      }),
      { state: "resolved" },
    );

    expect(change?.log.content).toBe(
      'Resolved thread — discarded upcoming moves: "Book slot", "Pay bill"',
    );
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
        nextMove: "Call clinic",
        upNext: ["Book slot"],
        followUp: may20,
      }),
      patch: { state: "resolved" },
      resolutionNote: "Done for good",
    });

    expect(decision.patch).toEqual({
      state: "resolved",
      nextMove: undefined,
      upNext: undefined,
      followUp: undefined,
    });
    expect(decision.logs).toEqual([
      {
        type: "next_move_change",
        content: "Next move cleared",
        previousValue: "Call clinic",
        newValue: undefined,
      },
      {
        type: "state_change",
        content:
          'Resolved thread: Done for good — discarded upcoming moves: "Book slot"',
        previousValue: "open",
        newValue: "resolved",
      },
      {
        type: "follow_up_change",
        content: "Follow-up cleared",
        previousValue: "May 20, 2026",
        newValue: undefined,
      },
    ]);
  });

  it("promotes Up Next when a clear would empty the slot, and logs the promotion", () => {
    const decision = decideThreadUpdate({
      thread: makeThread({ nextMove: "Call clinic", upNext: ["Book slot"] }),
      patch: { nextMove: undefined },
    });

    expect(decision.patch).toEqual({
      nextMove: "Book slot",
      upNext: undefined,
    });
    expect(decision.logs).toEqual([
      {
        type: "next_move_change",
        content: 'Next move changed from "Call clinic" to "Book slot"',
        previousValue: "Call clinic",
        newValue: "Book slot",
      },
    ]);
  });

  it("logs an Area move, a Next Move change, and a Follow-up change in order", () => {
    const decision = decideThreadUpdate({
      thread: makeThread({ nextMove: "Call clinic" }),
      patch: {
        areaId: "area2" as AreaId,
        nextMove: "Book checkup",
        followUp: may20,
      },
      areaNames: { from: "Health", to: "Home" },
    });

    expect(decision.logs.map((log) => log.type)).toEqual([
      "area_move",
      "next_move_change",
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
