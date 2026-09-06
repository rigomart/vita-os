import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  optimisticallyAddToOpenNotes,
  optimisticallyRemoveFromOpenNotes,
  optimisticallyReopenNote,
  patchOpenNotes,
  removeNoteFromInbox,
  updateNoteBodyInInbox,
  updateNoteWhenInInbox,
} from "./optimistic";

function makeNote(overrides: Partial<ProjectedNote> = {}): ProjectedNote {
  return {
    _id: "note1" as Id<"tasks">,
    _creationTime: 0,
    body: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

describe("Note optimistic updates", () => {
  it("removes discarded Notes from the unified Inbox list", () => {
    const keeping = makeNote({ _id: "keeping" as Id<"tasks"> });
    const removing = makeNote({ _id: "removing" as Id<"tasks"> });

    expect(removeNoteFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("updates a Note's body in the Inbox", () => {
    const updating = makeNote({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeNote({ _id: "unchanged" as Id<"tasks"> });

    expect(
      updateNoteBodyInInbox([updating, unchanged], updating._id, "Book labs"),
    ).toEqual([{ ...updating, body: "Book labs" }, unchanged]);
  });

  it("updates or clears a Note's When in the Inbox", () => {
    const updating = makeNote({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeNote({ _id: "unchanged" as Id<"tasks"> });

    const withWhen = updateNoteWhenInInbox(
      [updating, unchanged],
      updating._id,
      1000,
    );

    expect(withWhen).toEqual([{ ...updating, when: 1000 }, unchanged]);
    expect(updateNoteWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, when: undefined },
      unchanged,
    ]);
  });
});

describe("patchOpenNotes", () => {
  it("derives notes.count from the patched list", () => {
    const { store, get } = createLocalStore();
    const existing = makeNote({ _id: "existing" as Id<"tasks"> });
    store.setQuery(api.notes.list, {}, [existing]);
    store.setQuery(api.notes.count, {}, 1);

    const created = makeNote({ _id: "created" as Id<"tasks">, createdAt: 10 });
    patchOpenNotes(store, (notes) => [created, ...notes]);

    expect(get(api.notes.list, {})).toEqual([created, existing]);
    expect(get(api.notes.count, {})).toBe(2);
  });

  it("re-derives a stale notes.count rather than stepping it", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.notes.list, {}, [makeNote()]);
    store.setQuery(api.notes.count, {}, 7);

    patchOpenNotes(store, (notes) => notes);

    expect(get(api.notes.count, {})).toBe(1);
  });

  it("leaves notes.count alone when notes.list isn't cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.notes.count, {}, 3);

    patchOpenNotes(store, (notes) => [...notes, makeNote()]);

    expect(get(api.notes.list, {})).toBeUndefined();
    expect(get(api.notes.count, {})).toBe(3);
  });

  it("patches notes.list when notes.count isn't cached", () => {
    const { store, get } = createLocalStore();
    const removing = makeNote({ _id: "removing" as Id<"tasks"> });
    store.setQuery(api.notes.list, {}, [removing]);

    patchOpenNotes(store, (notes) => removeNoteFromInbox(notes, removing._id));

    expect(get(api.notes.list, {})).toEqual([]);
    expect(get(api.notes.count, {})).toBeUndefined();
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    patchOpenNotes(store, (notes) => [...notes, makeNote()]);

    expect(get(api.notes.list, {})).toBeUndefined();
    expect(get(api.notes.count, {})).toBeUndefined();
  });
});

describe("optimisticallyAddToOpenNotes", () => {
  it("adds the Note to notes.list and derives notes.count", () => {
    const { store, get } = createLocalStore();
    const existing = makeNote({ _id: "existing" as Id<"tasks">, createdAt: 1 });
    store.setQuery(api.notes.list, {}, [existing]);
    store.setQuery(api.notes.count, {}, 1);

    const created = makeNote({ _id: "created" as Id<"tasks">, createdAt: 2 });
    optimisticallyAddToOpenNotes(store, created);

    expect(get(api.notes.list, {})).toEqual([created, existing]);
    expect(get(api.notes.count, {})).toBe(2);
  });

  it("steps notes.count up when only the count is cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.notes.count, {}, 3);

    optimisticallyAddToOpenNotes(store, makeNote());

    expect(get(api.notes.list, {})).toBeUndefined();
    expect(get(api.notes.count, {})).toBe(4);
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    optimisticallyAddToOpenNotes(store, makeNote());

    expect(get(api.notes.list, {})).toBeUndefined();
    expect(get(api.notes.count, {})).toBeUndefined();
  });
});

describe("optimisticallyRemoveFromOpenNotes", () => {
  it("removes the Note from notes.list and derives notes.count", () => {
    const { store, get } = createLocalStore();
    const completing = makeNote({ _id: "completing" as Id<"tasks"> });
    const keeping = makeNote({ _id: "keeping" as Id<"tasks"> });
    store.setQuery(api.notes.list, {}, [completing, keeping]);
    store.setQuery(api.notes.count, {}, 2);

    optimisticallyRemoveFromOpenNotes(store, { id: completing._id });

    expect(get(api.notes.list, {})).toEqual([keeping]);
    expect(get(api.notes.count, {})).toBe(1);
  });

  it("re-derives a stale notes.count instead of stepping it down", () => {
    const { store, get } = createLocalStore();
    const completing = makeNote({ _id: "completing" as Id<"tasks"> });
    store.setQuery(api.notes.list, {}, [
      completing,
      makeNote({ _id: "second" as Id<"tasks"> }),
      makeNote({ _id: "third" as Id<"tasks"> }),
    ]);
    store.setQuery(api.notes.count, {}, 5);

    optimisticallyRemoveFromOpenNotes(store, { id: completing._id });

    expect(get(api.notes.count, {})).toBe(2);
  });

  it("leaves notes.count alone when only the count is cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.notes.count, {}, 3);

    optimisticallyRemoveFromOpenNotes(store, { id: "note1" as Id<"tasks"> });

    expect(get(api.notes.count, {})).toBe(3);
  });

  it("leaves notes.list alone when the Note isn't in the cached open list", () => {
    const { store, get } = createLocalStore();
    const other = makeNote({ _id: "other" as Id<"tasks"> });
    store.setQuery(api.notes.list, {}, [other]);
    store.setQuery(api.notes.count, {}, 1);

    optimisticallyRemoveFromOpenNotes(store, {
      id: "already-done" as Id<"tasks">,
    });

    expect(get(api.notes.list, {})).toEqual([other]);
    expect(get(api.notes.count, {})).toBe(1);
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    expect(() =>
      optimisticallyRemoveFromOpenNotes(store, {
        id: "note1" as Id<"tasks">,
      }),
    ).not.toThrow();
    expect(get(api.notes.list, {})).toBeUndefined();
    expect(get(api.notes.count, {})).toBeUndefined();
  });
});

describe("optimisticallyReopenNote", () => {
  it("reopens the Note into notes.list in server order and derives the count", () => {
    const { store, get } = createLocalStore();
    const newer = makeNote({ _id: "newer" as Id<"tasks">, createdAt: 300 });
    const older = makeNote({ _id: "older" as Id<"tasks">, createdAt: 100 });
    store.setQuery(api.notes.list, {}, [newer, older]);
    store.setQuery(api.notes.count, {}, 2);

    const reopening = makeNote({
      _id: "reopening" as Id<"tasks">,
      state: "done",
      completedAt: 500,
      createdAt: 200,
    });
    optimisticallyReopenNote(store, reopening);

    expect(get(api.notes.list, {})).toEqual([
      newer,
      { ...reopening, state: "open", completedAt: undefined },
      older,
    ]);
    expect(get(api.notes.count, {})).toBe(3);
  });

  it("puts the oldest Note last and the newest first", () => {
    const { store, get } = createLocalStore();
    const middle = makeNote({ _id: "middle" as Id<"tasks">, createdAt: 200 });
    store.setQuery(api.notes.list, {}, [middle]);

    optimisticallyReopenNote(
      store,
      makeNote({ _id: "oldest" as Id<"tasks">, createdAt: 100 }),
    );
    optimisticallyReopenNote(
      store,
      makeNote({ _id: "newest" as Id<"tasks">, createdAt: 300 }),
    );

    expect(
      (get(api.notes.list, {}) as Array<ProjectedNote>).map((note) => note._id),
    ).toEqual(["newest", "middle", "oldest"]);
  });

  it("breaks createdAt ties on creation time", () => {
    const { store, get } = createLocalStore();
    const first = makeNote({
      _id: "first" as Id<"tasks">,
      createdAt: 100,
      _creationTime: 1,
    });
    const third = makeNote({
      _id: "third" as Id<"tasks">,
      createdAt: 100,
      _creationTime: 3,
    });
    store.setQuery(api.notes.list, {}, [third, first]);

    optimisticallyReopenNote(
      store,
      makeNote({
        _id: "second" as Id<"tasks">,
        createdAt: 100,
        _creationTime: 2,
      }),
    );

    expect(
      (get(api.notes.list, {}) as Array<ProjectedNote>).map((note) => note._id),
    ).toEqual(["third", "second", "first"]);
  });

  it("leaves the caches alone when the Note is already open", () => {
    const { store, get } = createLocalStore();
    const note = makeNote();
    store.setQuery(api.notes.list, {}, [note]);
    store.setQuery(api.notes.count, {}, 1);

    optimisticallyReopenNote(store, note);

    expect(get(api.notes.list, {})).toEqual([note]);
    expect(get(api.notes.count, {})).toBe(1);
  });

  it("keeps notes.count in step through a run of Inbox actions", () => {
    const { store, get } = createLocalStore();
    const first = makeNote({ _id: "first" as Id<"tasks">, createdAt: 100 });
    const second = makeNote({ _id: "second" as Id<"tasks">, createdAt: 200 });
    store.setQuery(api.notes.list, {}, [second, first]);
    store.setQuery(api.notes.count, {}, 2);

    optimisticallyRemoveFromOpenNotes(store, { id: first._id });
    optimisticallyRemoveFromOpenNotes(store, { id: second._id });
    optimisticallyAddToOpenNotes(
      store,
      makeNote({ _id: "third" as Id<"tasks">, createdAt: 300 }),
    );
    optimisticallyReopenNote(store, { ...first, state: "done" });

    const list = get(api.notes.list, {}) as Array<ProjectedNote>;
    expect(list.map((note) => note._id)).toEqual(["third", "first"]);
    expect(get(api.notes.count, {})).toBe(list.length);
  });
});
