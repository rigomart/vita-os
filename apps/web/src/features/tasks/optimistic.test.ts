import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedTask } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  isUnprocessedTask,
  optimisticallyAddToOpenTasks,
  optimisticallyRemoveFromOpenTasks,
  optimisticallyReopenTask,
  patchOpenTasks,
  removeTaskFromInbox,
  updateTaskTextInInbox,
  updateTaskWhenInInbox,
} from "./optimistic";

function makeTask(overrides: Partial<ProjectedTask> = {}): ProjectedTask {
  return {
    _id: "task1" as Id<"tasks">,
    _creationTime: 0,
    text: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
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

describe("patchOpenTasks", () => {
  it("derives tasks.count from the patched list", () => {
    const { store, get } = createLocalStore();
    const existing = makeTask({ _id: "existing" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [existing]);
    store.setQuery(api.tasks.count, {}, 1);

    const created = makeTask({ _id: "created" as Id<"tasks">, createdAt: 10 });
    patchOpenTasks(store, (tasks) => [created, ...tasks]);

    expect(get(api.tasks.list, {})).toEqual([created, existing]);
    expect(get(api.tasks.count, {})).toBe(2);
  });

  it("re-derives a stale tasks.count rather than stepping it", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.tasks.list, {}, [makeTask()]);
    store.setQuery(api.tasks.count, {}, 7);

    patchOpenTasks(store, (tasks) => tasks);

    expect(get(api.tasks.count, {})).toBe(1);
  });

  it("leaves tasks.count alone when tasks.list isn't cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.tasks.count, {}, 3);

    patchOpenTasks(store, (tasks) => [...tasks, makeTask()]);

    expect(get(api.tasks.list, {})).toBeUndefined();
    expect(get(api.tasks.count, {})).toBe(3);
  });

  it("patches tasks.list when tasks.count isn't cached", () => {
    const { store, get } = createLocalStore();
    const removing = makeTask({ _id: "removing" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [removing]);

    patchOpenTasks(store, (tasks) => removeTaskFromInbox(tasks, removing._id));

    expect(get(api.tasks.list, {})).toEqual([]);
    expect(get(api.tasks.count, {})).toBeUndefined();
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    patchOpenTasks(store, (tasks) => [...tasks, makeTask()]);

    expect(get(api.tasks.list, {})).toBeUndefined();
    expect(get(api.tasks.count, {})).toBeUndefined();
  });
});

describe("optimisticallyAddToOpenTasks", () => {
  it("adds the Task to tasks.list and derives tasks.count", () => {
    const { store, get } = createLocalStore();
    const existing = makeTask({ _id: "existing" as Id<"tasks">, createdAt: 1 });
    store.setQuery(api.tasks.list, {}, [existing]);
    store.setQuery(api.tasks.count, {}, 1);

    const created = makeTask({ _id: "created" as Id<"tasks">, createdAt: 2 });
    optimisticallyAddToOpenTasks(store, created);

    expect(get(api.tasks.list, {})).toEqual([created, existing]);
    expect(get(api.tasks.count, {})).toBe(2);
  });

  it("steps tasks.count up when only the count is cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.tasks.count, {}, 3);

    optimisticallyAddToOpenTasks(store, makeTask());

    expect(get(api.tasks.list, {})).toBeUndefined();
    expect(get(api.tasks.count, {})).toBe(4);
  });

  it("is a no-op when neither cache has been populated yet", () => {
    const { store, get } = createLocalStore();

    optimisticallyAddToOpenTasks(store, makeTask());

    expect(get(api.tasks.list, {})).toBeUndefined();
    expect(get(api.tasks.count, {})).toBeUndefined();
  });
});

describe("optimisticallyRemoveFromOpenTasks", () => {
  it("removes the Task from tasks.list and derives tasks.count", () => {
    const { store, get } = createLocalStore();
    const completing = makeTask({ _id: "completing" as Id<"tasks"> });
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [completing, keeping]);
    store.setQuery(api.tasks.count, {}, 2);

    optimisticallyRemoveFromOpenTasks(store, { id: completing._id });

    expect(get(api.tasks.list, {})).toEqual([keeping]);
    expect(get(api.tasks.count, {})).toBe(1);
  });

  it("re-derives a stale tasks.count instead of stepping it down", () => {
    const { store, get } = createLocalStore();
    const completing = makeTask({ _id: "completing" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [
      completing,
      makeTask({ _id: "second" as Id<"tasks"> }),
      makeTask({ _id: "third" as Id<"tasks"> }),
    ]);
    store.setQuery(api.tasks.count, {}, 5);

    optimisticallyRemoveFromOpenTasks(store, { id: completing._id });

    expect(get(api.tasks.count, {})).toBe(2);
  });

  it("leaves tasks.count alone when only the count is cached", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.tasks.count, {}, 3);

    optimisticallyRemoveFromOpenTasks(store, { id: "task1" as Id<"tasks"> });

    expect(get(api.tasks.count, {})).toBe(3);
  });

  it("leaves tasks.list alone when the Task isn't in the cached open list", () => {
    const { store, get } = createLocalStore();
    const other = makeTask({ _id: "other" as Id<"tasks"> });
    store.setQuery(api.tasks.list, {}, [other]);
    store.setQuery(api.tasks.count, {}, 1);

    optimisticallyRemoveFromOpenTasks(store, {
      id: "already-done" as Id<"tasks">,
    });

    expect(get(api.tasks.list, {})).toEqual([other]);
    expect(get(api.tasks.count, {})).toBe(1);
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

describe("optimisticallyReopenTask", () => {
  it("reopens the Task into tasks.list in server order and derives the count", () => {
    const { store, get } = createLocalStore();
    const newer = makeTask({ _id: "newer" as Id<"tasks">, createdAt: 300 });
    const older = makeTask({ _id: "older" as Id<"tasks">, createdAt: 100 });
    store.setQuery(api.tasks.list, {}, [newer, older]);
    store.setQuery(api.tasks.count, {}, 2);

    const reopening = makeTask({
      _id: "reopening" as Id<"tasks">,
      state: "done",
      completedAt: 500,
      createdAt: 200,
    });
    optimisticallyReopenTask(store, reopening);

    expect(get(api.tasks.list, {})).toEqual([
      newer,
      { ...reopening, state: "open", completedAt: undefined },
      older,
    ]);
    expect(get(api.tasks.count, {})).toBe(3);
  });

  it("puts the oldest Task last and the newest first", () => {
    const { store, get } = createLocalStore();
    const middle = makeTask({ _id: "middle" as Id<"tasks">, createdAt: 200 });
    store.setQuery(api.tasks.list, {}, [middle]);

    optimisticallyReopenTask(
      store,
      makeTask({ _id: "oldest" as Id<"tasks">, createdAt: 100 }),
    );
    optimisticallyReopenTask(
      store,
      makeTask({ _id: "newest" as Id<"tasks">, createdAt: 300 }),
    );

    expect(
      (get(api.tasks.list, {}) as Array<ProjectedTask>).map((task) => task._id),
    ).toEqual(["newest", "middle", "oldest"]);
  });

  it("breaks createdAt ties on creation time", () => {
    const { store, get } = createLocalStore();
    const first = makeTask({
      _id: "first" as Id<"tasks">,
      createdAt: 100,
      _creationTime: 1,
    });
    const third = makeTask({
      _id: "third" as Id<"tasks">,
      createdAt: 100,
      _creationTime: 3,
    });
    store.setQuery(api.tasks.list, {}, [third, first]);

    optimisticallyReopenTask(
      store,
      makeTask({
        _id: "second" as Id<"tasks">,
        createdAt: 100,
        _creationTime: 2,
      }),
    );

    expect(
      (get(api.tasks.list, {}) as Array<ProjectedTask>).map((task) => task._id),
    ).toEqual(["third", "second", "first"]);
  });

  it("leaves the caches alone when the Task is already open", () => {
    const { store, get } = createLocalStore();
    const task = makeTask();
    store.setQuery(api.tasks.list, {}, [task]);
    store.setQuery(api.tasks.count, {}, 1);

    optimisticallyReopenTask(store, task);

    expect(get(api.tasks.list, {})).toEqual([task]);
    expect(get(api.tasks.count, {})).toBe(1);
  });

  it("keeps tasks.count in step through a run of Inbox actions", () => {
    const { store, get } = createLocalStore();
    const first = makeTask({ _id: "first" as Id<"tasks">, createdAt: 100 });
    const second = makeTask({ _id: "second" as Id<"tasks">, createdAt: 200 });
    store.setQuery(api.tasks.list, {}, [second, first]);
    store.setQuery(api.tasks.count, {}, 2);

    optimisticallyRemoveFromOpenTasks(store, { id: first._id });
    optimisticallyRemoveFromOpenTasks(store, { id: second._id });
    optimisticallyAddToOpenTasks(
      store,
      makeTask({ _id: "third" as Id<"tasks">, createdAt: 300 }),
    );
    optimisticallyReopenTask(store, { ...first, state: "done" });

    const list = get(api.tasks.list, {}) as Array<ProjectedTask>;
    expect(list.map((task) => task._id)).toEqual(["third", "first"]);
    expect(get(api.tasks.count, {})).toBe(list.length);
  });
});
