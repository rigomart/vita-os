import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";

import {
  isUnprocessedTask,
  optimisticallyRemoveFromOpenTasks,
  removeTaskFromInbox,
  updateTaskTextInInbox,
  updateTaskWhenInInbox,
} from "./optimistic";

function makeTask(overrides: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: "task1" as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function createLocalStore() {
  const entries: Array<{
    query: unknown;
    args: unknown;
    value: unknown;
  }> = [];

  const queryKey = (query: unknown) => getFunctionName(query as never);
  const findEntry = (query: unknown, args: unknown) =>
    entries.find(
      (entry) =>
        entry.query === queryKey(query) &&
        JSON.stringify(entry.args) === JSON.stringify(args),
    );

  return {
    store: {
      getQuery(query: unknown, args: unknown) {
        return findEntry(query, args)?.value;
      },
      setQuery(query: unknown, args: unknown, value: unknown) {
        const entry = findEntry(query, args);
        if (entry) {
          entry.value = value;
        } else {
          entries.push({ query: queryKey(query), args, value });
        }
      },
    } as OptimisticLocalStore,
    get(query: unknown, args: unknown) {
      return findEntry(query, args)?.value;
    },
  };
}

describe("Task optimistic updates", () => {
  it("removes discarded Tasks from the unified Inbox list", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });
    const removing = makeTask({ _id: "removing" as Id<"tasks"> });

    expect(removeTaskFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("updates a Task's text in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"tasks"> });

    expect(
      updateTaskTextInInbox([updating, unchanged], updating._id, "Book labs"),
    ).toEqual([{ ...updating, text: "Book labs" }, unchanged]);
  });

  it("updates or clears a Task's When in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"tasks"> });

    const withWhen = updateTaskWhenInInbox(
      [updating, unchanged],
      updating._id,
      1000,
    );

    expect(withWhen).toEqual([{ ...updating, when: 1000 }, unchanged]);
    expect(updateTaskWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, when: undefined },
      unchanged,
    ]);
  });

  it("counts only Open Tasks without When as unprocessed", () => {
    expect(isUnprocessedTask(makeTask())).toBe(true);
    expect(isUnprocessedTask(makeTask({ when: 500 }))).toBe(false);
    expect(isUnprocessedTask(makeTask({ state: "done" }))).toBe(false);
  });
});

describe("optimisticallyRemoveFromOpenTasks", () => {
  it("removes the Task from tasks.list and decrements tasks.count", () => {
    const { store, get } = createLocalStore();
    const completing = makeTask({ _id: "completing" as Id<"tasks"> });
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [completing, keeping]);
    store.setQuery(api.tasks.count, {}, 2);

    optimisticallyRemoveFromOpenTasks(store, { id: completing._id });

    expect(get(api.tasks.list, {})).toEqual([keeping]);
    expect(get(api.tasks.count, {})).toBe(1);
  });

  it("never drops tasks.count below zero", () => {
    const { store, get } = createLocalStore();
    const completing = makeTask({ _id: "completing" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [completing]);
    store.setQuery(api.tasks.count, {}, 0);

    optimisticallyRemoveFromOpenTasks(store, { id: completing._id });

    expect(get(api.tasks.count, {})).toBe(0);
  });

  it("leaves tasks.count untouched when the Task isn't in the cached open list", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.tasks.list, {}, [
      makeTask({ _id: "other" as Id<"tasks"> }),
    ]);
    store.setQuery(api.tasks.count, {}, 3);

    optimisticallyRemoveFromOpenTasks(store, {
      id: "already-done" as Id<"tasks">,
    });

    expect(get(api.tasks.list, {})).toEqual([
      makeTask({ _id: "other" as Id<"tasks"> }),
    ]);
    expect(get(api.tasks.count, {})).toBe(3);
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    expect(() =>
      optimisticallyRemoveFromOpenTasks(store, {
        id: "task1" as Id<"tasks">,
      }),
    ).not.toThrow();
    expect(get(api.tasks.list, {})).toBeUndefined();
    expect(get(api.tasks.count, {})).toBeUndefined();
  });
});
