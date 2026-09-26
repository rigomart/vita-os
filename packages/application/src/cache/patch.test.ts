import type { AreaId, NoteId, ThreadId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { buildPendingArea } from "../areas/optimistic";
import {
  buildPendingThread,
  completeNextMoveLocally,
  replaceUpNextLocally,
} from "../threads/optimistic";
import {
  insertNewestFirst,
  insertOrdered,
  nextOrder,
  patchById,
  removeById,
} from "./patch";

/**
 * The pure half of the optimistic behavior.
 *
 * These are the shapes every command's on-screen change is built from, so they
 * are worth pinning on their own rather than only through the hooks that use
 * them.
 */
describe("patching a list", () => {
  const records = [
    { _id: "a", order: 0 },
    { _id: "b", order: 1 },
  ];

  it("changes only the record named", () => {
    expect(patchById(records, "b", { order: 9 })).toEqual([
      { _id: "a", order: 0 },
      { _id: "b", order: 9 },
    ]);
  });

  it("leaves a list alone when the record is not in it", () => {
    expect(patchById(records, "absent", { order: 9 })).toEqual(records);
    expect(removeById(records, "absent")).toEqual(records);
  });

  it("takes a record out", () => {
    expect(removeById(records, "a")).toEqual([{ _id: "b", order: 1 }]);
  });

  it("gives a new record the next manual position", () => {
    expect(nextOrder(records)).toBe(2);
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([{ order: 7 }, { order: 3 }])).toBe(8);
  });
});

describe("inserting where the service would", () => {
  it("keeps an ascending list ascending", () => {
    const threads = [{ at: 1 }, { at: 3 }];

    expect(insertOrdered(threads, { at: 2 }, (thread) => thread.at)).toEqual([
      { at: 1 },
      { at: 2 },
      { at: 3 },
    ]);
    expect(insertOrdered(threads, { at: 9 }, (thread) => thread.at)).toEqual([
      { at: 1 },
      { at: 3 },
      { at: 9 },
    ]);
  });

  it("puts a record into a newest-first list by time, then by ID", () => {
    const notes = [
      { _id: "c", createdAt: 3 },
      { _id: "a", createdAt: 1 },
    ];

    expect(
      insertNewestFirst(notes, { _id: "b", createdAt: 2 }, (n) => n.createdAt),
    ).toEqual([
      { _id: "c", createdAt: 3 },
      { _id: "b", createdAt: 2 },
      { _id: "a", createdAt: 1 },
    ]);
    // A tie is broken the way the service breaks it: the later ID reads first.
    expect(
      insertNewestFirst(notes, { _id: "d", createdAt: 3 }, (n) => n.createdAt),
    ).toEqual([
      { _id: "d", createdAt: 3 },
      { _id: "c", createdAt: 3 },
      { _id: "a", createdAt: 1 },
    ]);
  });
});

describe("a pending record", () => {
  it("looks like the Area the service will store, with a placeholder slug", () => {
    const pending = buildPendingArea(
      { name: "Family Health", icon: "HeartPulse" },
      { id: "pending" as AreaId, now: 1_000, order: 2 },
    );

    expect(pending).toMatchObject({
      _id: "pending",
      name: "Family Health",
      icon: "HeartPulse",
      order: 2,
      createdAt: 1_000,
    });
    expect(pending.slug).toMatch(/^family-health-[0-9a-f]{8}$/);
    expect(pending).not.toHaveProperty("standard");
  });

  it("looks like the Thread the service will store, at revision zero", () => {
    const pending = buildPendingThread(
      { title: "Book checkup", areaId: "area-1" as AreaId },
      { id: "pending" as ThreadId, now: 2_000, order: 1 },
    );

    expect(pending).toMatchObject({
      title: "Book checkup",
      areaId: "area-1",
      state: "open",
      order: 1,
      createdAt: 2_000,
      revision: 0,
    });
    expect(pending).not.toHaveProperty("summary");
  });
});

describe("the attention rules applied locally", () => {
  it("completing promotes the front of Up Next", () => {
    expect(
      completeNextMoveLocally({
        nextMove: "Call clinic",
        upNext: ["Book appointment", "Collect results"],
      }),
    ).toEqual({ nextMove: "Book appointment", upNext: ["Collect results"] });
  });

  it("completing the last move leaves the slot empty", () => {
    expect(completeNextMoveLocally({ nextMove: "Call clinic" })).toEqual({
      nextMove: undefined,
      upNext: undefined,
    });
  });

  it("completing nothing changes nothing", () => {
    const thread = { upNext: ["Book appointment"] };

    expect(completeNextMoveLocally(thread)).toBe(thread);
  });

  it("rewriting Up Next fills an empty slot from the front of the line", () => {
    expect(replaceUpNextLocally({}, ["Book appointment", "Pay bill"])).toEqual({
      nextMove: "Book appointment",
      upNext: ["Pay bill"],
    });
  });

  it("rewriting Up Next leaves a filled slot alone, and forgets an empty line", () => {
    expect(
      replaceUpNextLocally({ nextMove: "Call clinic" }, ["Pay bill"]),
    ).toEqual({ nextMove: "Call clinic", upNext: ["Pay bill"] });
    expect(replaceUpNextLocally({ nextMove: "Call clinic" }, [])).toEqual({
      nextMove: "Call clinic",
      upNext: undefined,
    });
  });
});

describe("what a Note keeps through a local change", () => {
  it("carries its own identity into the list", () => {
    const note = {
      _id: "note-1" as NoteId,
      body: "Refill prescription",
      state: "open" as const,
      createdAt: 5,
    };

    expect(patchById([note], note._id, { body: "Refill both" })).toEqual([
      { ...note, body: "Refill both" },
    ]);
  });
});
