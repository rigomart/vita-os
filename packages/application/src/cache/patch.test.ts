import type { AreaId, TaskId, NoteId, ThreadId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { buildPendingArea } from "../areas/optimistic";
import { createTestQueryClient } from "../test/render-with-providers";
import { buildPendingThread, changeTasksLocally } from "../threads/optimistic";
import {
  changeRecords,
  patchPagedEntries,
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

  it("looks like the Thread the service will store", () => {
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
    });
    expect(pending).not.toHaveProperty("summary");
  });
});

describe("the Task rules applied locally", () => {
  const complete = (taskId: TaskId) => ({
    kind: "complete" as const,
    taskId,
    occurrence: undefined,
    timeZone: "UTC",
    now: 0,
  });
  const callClinic = { _id: "task-1" as TaskId, text: "Call clinic" };
  const bookSlot = { _id: "task-2" as TaskId, text: "Book slot" };
  const open = {
    state: "open" as const,
    tasks: [callClinic, bookSlot],
    focusedTaskId: callClinic._id,
  };

  it("completing the Focused Task leaves the Thread unfocused, promoting nothing", () => {
    expect(changeTasksLocally(open, complete(callClinic._id))).toEqual({
      state: "open",
      tasks: [bookSlot],
    });
  });

  it("completing the last Task leaves no Tasks at all", () => {
    expect(
      changeTasksLocally(
        { state: "open" as const, tasks: [bookSlot] },
        complete(bookSlot._id),
      ),
    ).toEqual({ state: "open" });
  });

  it("adding joins the end of the list, unfocused", () => {
    const payBill = { _id: "task-3" as TaskId, text: "Pay bill" };

    expect(changeTasksLocally(open, { kind: "add", task: payBill })).toEqual({
      ...open,
      tasks: [callClinic, bookSlot, payBill],
    });
  });

  it("a command the service would refuse changes nothing on screen", () => {
    const resolved = { state: "resolved" as const };

    expect(changeTasksLocally(resolved, { kind: "focus", taskId: null })).toBe(
      resolved,
    );
    expect(changeTasksLocally(open, complete("gone" as TaskId))).toBe(open);
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

describe("paged rollback", () => {
  it("restores only an edited Note field, keeping a later Note write and current cursor", () => {
    const cache = createTestQueryClient();
    const key = ["paged"];
    const before = {
      pages: [
        {
          entries: [
            { _id: "a", body: "Original", followUp: 1 },
            { _id: "b", body: "Original", followUp: 1 },
          ],
          nextCursor: "old",
        },
      ],
      pageParams: [undefined],
    };
    cache.setQueryData(key, before);
    const undo = changeRecords<{ _id: string; body: string; followUp: number }>(
      cache,
      [key],
      ["a"],
      ["body"],
      () =>
        patchPagedEntries<{ _id: string; body: string; followUp: number }>(
          cache,
          key,
          (entries) => patchById(entries, "a", { body: "Pending" }),
        ),
    );
    cache.setQueryData<typeof before>(key, (current) => ({
      ...current!,
      pages: current!.pages.map((page) => ({
        ...page,
        nextCursor: "new",
        entries: page.entries.map((note) =>
          note._id === "a"
            ? { ...note, followUp: 9 }
            : { ...note, body: "Saved" },
        ),
      })),
    }));
    undo.rollback();
    expect(cache.getQueryData(key)).toEqual({
      ...before,
      pages: [
        {
          entries: [
            { _id: "a", body: "Original", followUp: 9 },
            { _id: "b", body: "Saved", followUp: 1 },
          ],
          nextCursor: "new",
        },
      ],
    });
  });
});

describe("rollback after a Note changes pages", () => {
  it("does not insert a removed Note again when refetch has moved it to another page", () => {
    const cache = createTestQueryClient();
    const key = ["moved-note"];
    const a = { _id: "a", body: "Original" };
    const b = { _id: "b", body: "B" };
    const c = { _id: "c", body: "C" };
    cache.setQueryData(key, {
      pages: [
        { entries: [a], nextCursor: "old-1" },
        { entries: [b], nextCursor: "old-2" },
      ],
      pageParams: [undefined, "old-1"],
    });
    const undo = changeRecords<{ _id: string; body: string }>(
      cache,
      [key],
      ["a"],
      [],
      () =>
        patchPagedEntries<{ _id: string; body: string }>(
          cache,
          key,
          (entries) => removeById(entries, "a"),
        ),
    );
    const refetched = {
      pages: [
        { entries: [c], nextCursor: "new-1" },
        {
          entries: [{ ...a, body: "Saved elsewhere" }, b],
          nextCursor: "new-2",
        },
      ],
      pageParams: [undefined, "new-1"],
    };
    cache.setQueryData(key, refetched);
    undo.rollback();
    expect(cache.getQueryData(key)).toEqual(refetched);
  });
  it("rolls back an edited Note on its current page while preserving later fields", () => {
    const cache = createTestQueryClient();
    const key = ["moved-edit"];
    const a = { _id: "a", body: "Original", followUp: 1 };
    const b = { _id: "b", body: "B", followUp: 1 };
    cache.setQueryData(key, {
      pages: [
        { entries: [a], nextCursor: "old-1" },
        { entries: [b], nextCursor: "old-2" },
      ],
      pageParams: [undefined, "old-1"],
    });
    const undo = changeRecords<typeof a>(cache, [key], ["a"], ["body"], () =>
      patchPagedEntries<typeof a>(cache, key, (entries) =>
        patchById(entries, "a", { body: "Pending" }),
      ),
    );
    const refetched = {
      pages: [
        { entries: [], nextCursor: "new-1" },
        {
          entries: [{ ...a, body: "Pending", followUp: 9 }, b],
          nextCursor: "new-2",
        },
      ],
      pageParams: [undefined, "new-1"],
    };
    cache.setQueryData(key, refetched);
    undo.rollback();
    expect(cache.getQueryData(key)).toEqual({
      ...refetched,
      pages: [
        refetched.pages[0],
        { ...refetched.pages[1], entries: [{ ...a, followUp: 9 }, b] },
      ],
    });
  });
});
