import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  nextOrder,
  patchAllQueries,
  patchById,
  patchQuery,
  removeById,
} from "./optimistic";

type TestRecord = {
  _id: string;
  name: string;
  order: number;
};

function makeRecord(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    _id: "record1",
    name: "Family Health",
    order: 0,
    ...overrides,
  };
}

function makeThread(overrides: Partial<Doc<"threads">> = {}): Doc<"threads"> {
  return {
    _id: "thread1" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Book checkup",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

describe("optimistic update helpers", () => {
  it("patches an task by id without mutating other tasks", () => {
    const record = makeRecord();
    const other = makeRecord({ _id: "record2", name: "Career" });

    expect(patchById([record, other], record._id, { name: "Health" })).toEqual([
      { ...record, name: "Health" },
      other,
    ]);
  });

  it("removes an task by id", () => {
    const record = makeRecord();
    const other = makeRecord({ _id: "record2", name: "Career" });

    expect(removeById([record, other], record._id)).toEqual([other]);
  });

  it("computes the next order after the current max", () => {
    expect(nextOrder([{ order: 2 }, { order: 9 }, { order: 4 }])).toBe(10);
  });

  it("starts order at zero for an empty list", () => {
    expect(nextOrder([])).toBe(0);
  });
});

describe("patchQuery", () => {
  it("writes the patched value back to the query it read", () => {
    const { store, get } = createLocalStore();
    const thread = makeThread();
    store.setQuery(api.threads.list, {}, [thread]);

    patchQuery(store, api.threads.list, {}, (threads) =>
      threads.map((current) => ({ ...current, title: "Book labs" })),
    );

    expect(get(api.threads.list, {})).toEqual([
      { ...thread, title: "Book labs" },
    ]);
  });

  it("leaves a query the client hasn't loaded alone", () => {
    const { store, get } = createLocalStore();
    let patched = false;

    patchQuery(store, api.threads.list, {}, (threads) => {
      patched = true;
      return threads;
    });

    expect(patched).toBe(false);
    expect(get(api.threads.list, {})).toBeUndefined();
  });

  it("leaves a missing document alone", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.threads.get, { id: "thread1" as Id<"threads"> }, null);

    patchQuery(store, api.threads.get, { id: "thread1" as Id<"threads"> }, () =>
      makeThread(),
    );

    expect(get(api.threads.get, { id: "thread1" })).toBeNull();
  });

  it("patches only the argument set it was given", () => {
    const { store, get } = createLocalStore();
    const area1 = "area1" as Id<"areas">;
    const area2 = "area2" as Id<"areas">;
    store.setQuery(api.threads.listByArea, { areaId: area1 }, []);
    store.setQuery(api.threads.listByArea, { areaId: area2 }, []);

    patchQuery(store, api.threads.listByArea, { areaId: area1 }, (threads) => [
      ...threads,
      makeThread({ areaId: area1 }),
    ]);

    expect(get(api.threads.listByArea, { areaId: area1 })).toHaveLength(1);
    expect(get(api.threads.listByArea, { areaId: area2 })).toEqual([]);
  });
});

describe("patchAllQueries", () => {
  it("patches every cached argument set and passes each its arguments", () => {
    const { store, get } = createLocalStore();
    const area1 = "area1" as Id<"areas">;
    const area2 = "area2" as Id<"areas">;
    store.setQuery(api.threads.listByArea, { areaId: area1 }, [
      makeThread({ _id: "thread1" as Id<"threads">, areaId: area1 }),
    ]);
    store.setQuery(api.threads.listByArea, { areaId: area2 }, [
      makeThread({ _id: "thread2" as Id<"threads">, areaId: area2 }),
    ]);

    patchAllQueries(store, api.threads.listByArea, (threads, args) =>
      threads.map((thread) => ({ ...thread, title: args.areaId })),
    );

    expect(get(api.threads.listByArea, { areaId: area1 })).toEqual([
      makeThread({
        _id: "thread1" as Id<"threads">,
        areaId: area1,
        title: area1,
      }),
    ]);
    expect(get(api.threads.listByArea, { areaId: area2 })).toEqual([
      makeThread({
        _id: "thread2" as Id<"threads">,
        areaId: area2,
        title: area2,
      }),
    ]);
  });

  it("skips argument sets the client is still loading", () => {
    const { store, get } = createLocalStore();
    const area1 = "area1" as Id<"areas">;
    const area2 = "area2" as Id<"areas">;
    store.setQuery(api.threads.listByArea, { areaId: area1 }, []);
    store.setQuery(api.threads.listByArea, { areaId: area2 }, undefined);

    patchAllQueries(store, api.threads.listByArea, (threads) => [
      ...threads,
      makeThread(),
    ]);

    expect(get(api.threads.listByArea, { areaId: area1 })).toHaveLength(1);
    expect(get(api.threads.listByArea, { areaId: area2 })).toBeUndefined();
  });

  it("does nothing when no argument set is cached", () => {
    const { store } = createLocalStore();
    let patched = false;

    patchAllQueries(store, api.threads.listByArea, (threads) => {
      patched = true;
      return threads;
    });

    expect(patched).toBe(false);
  });
});
