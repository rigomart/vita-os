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

/** A slug-keyed composite: the one query cached under several argument sets. */
function makeDetail(slug: string, title = "Book checkup") {
  return { thread: makeThread({ slug, title }), area: null };
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
    store.setQuery(api.threads.detailBySlug, { slug: "a" }, makeDetail("a"));
    store.setQuery(api.threads.detailBySlug, { slug: "b" }, makeDetail("b"));

    patchQuery(store, api.threads.detailBySlug, { slug: "a" }, (detail) => ({
      ...detail,
      thread: { ...detail.thread, title: "Book labs" },
    }));

    expect(get(api.threads.detailBySlug, { slug: "a" })).toEqual(
      makeDetail("a", "Book labs"),
    );
    expect(get(api.threads.detailBySlug, { slug: "b" })).toEqual(
      makeDetail("b"),
    );
  });
});

describe("patchAllQueries", () => {
  it("patches every cached argument set and passes each its arguments", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.threads.detailBySlug, { slug: "a" }, makeDetail("a"));
    store.setQuery(api.threads.detailBySlug, { slug: "b" }, makeDetail("b"));

    patchAllQueries(store, api.threads.detailBySlug, (detail, args) => ({
      ...detail,
      thread: { ...detail.thread, title: args.slug },
    }));

    expect(get(api.threads.detailBySlug, { slug: "a" })).toEqual(
      makeDetail("a", "a"),
    );
    expect(get(api.threads.detailBySlug, { slug: "b" })).toEqual(
      makeDetail("b", "b"),
    );
  });

  it("skips argument sets the client is still loading", () => {
    const { store, get } = createLocalStore();
    store.setQuery(api.threads.detailBySlug, { slug: "a" }, makeDetail("a"));
    store.setQuery(api.threads.detailBySlug, { slug: "b" }, undefined);

    patchAllQueries(store, api.threads.detailBySlug, (detail) => ({
      ...detail,
      thread: { ...detail.thread, title: "patched" },
    }));

    expect(get(api.threads.detailBySlug, { slug: "a" })).toEqual(
      makeDetail("a", "patched"),
    );
    expect(get(api.threads.detailBySlug, { slug: "b" })).toBeUndefined();
  });

  it("does nothing when no argument set is cached", () => {
    const { store } = createLocalStore();
    let patched = false;

    patchAllQueries(store, api.threads.detailBySlug, (detail) => {
      patched = true;
      return detail;
    });

    expect(patched).toBe(false);
  });
});
