import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import { usePlanActions } from "./use-plan-actions";

type OptimisticUpdate = (
  localStore: OptimisticLocalStore,
  args: Record<string, unknown>,
) => void;

const mocks = vi.hoisted(() => ({
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  optimistic: new Map<string, unknown>(),
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    const mutation =
      mocks.mutations.get(name) ??
      vi.fn(() => Promise.resolve(undefined as unknown));
    mocks.mutations.set(name, mutation);
    return Object.assign(mutation, {
      withOptimisticUpdate: (update: unknown) => {
        mocks.optimistic.set(name, update);
        return mutation;
      },
    });
  },
}));

vi.mock("@vita-os/ui/lib/feedback", () => ({
  useFeedback: () => ({ error: vi.fn(), success: vi.fn() }),
}));

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

function makeArea(id: string, slug: string): Doc<"areas"> {
  return {
    _id: id as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: id,
    slug,
    condition: "healthy",
    order: 0,
    createdAt: 0,
  };
}

function makeTask(overrides: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: "task1" as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: "Renew passport",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function optimisticFor(name: string): OptimisticUpdate {
  const update = mocks.optimistic.get(name);
  if (!update) throw new Error(`No optimistic update captured for ${name}`);
  return update as OptimisticUpdate;
}

describe("usePlanActions", () => {
  beforeEach(() => {
    mocks.mutations.clear();
    mocks.optimistic.clear();
  });

  it("moves a Thread across cached Area pages from the caller's copy", () => {
    const area1 = makeArea("area1", "family-health");
    const area2 = makeArea("area2", "work");
    const thread = makeThread({ slug: "book-checkup" });
    const { result } = renderHook(() =>
      usePlanActions({ areas: [area1, area2], threads: [thread] }),
    );

    result.current.planThread(thread._id, { areaId: area2._id });

    const updateThread = mocks.mutations.get("threads:update");
    expect(updateThread).toHaveBeenCalledWith({
      id: thread._id,
      areaId: area2._id,
    });

    const localStore = createLocalStore();
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area: area1, threads: [thread] },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: "work" },
      { area: area2, threads: [] },
    );
    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area: area1 },
    );

    optimisticFor("threads:update")(localStore.store, {
      id: thread._id,
      areaId: area2._id,
    });

    const moved = { ...thread, areaId: area2._id };
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area: area1, threads: [] });
    expect(localStore.get(api.areas.detailBySlug, { slug: "work" })).toEqual({
      area: area2,
      threads: [moved],
    });
    // The rail follows the move: its embedded Area becomes the destination.
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: moved, area: area2 });
  });

  it("inserts into the destination even when the previous Area page is uncached", () => {
    const area2 = makeArea("area2", "work");
    const thread = makeThread();
    renderHook(() => usePlanActions({ areas: [area2], threads: [thread] }));

    const localStore = createLocalStore();
    localStore.set(
      api.areas.detailBySlug,
      { slug: "work" },
      { area: area2, threads: [] },
    );

    optimisticFor("threads:update")(localStore.store, {
      id: thread._id,
      areaId: area2._id,
    });

    expect(localStore.get(api.areas.detailBySlug, { slug: "work" })).toEqual({
      area: area2,
      threads: [{ ...thread, areaId: area2._id }],
    });
  });

  it("skips a Thread drop the source no longer holds", () => {
    const { result } = renderHook(() =>
      usePlanActions({ areas: [], threads: [] }),
    );

    result.current.planThread("gone", { followUp: 123 });

    expect(mocks.mutations.get("threads:update")).not.toHaveBeenCalled();
  });

  it("plans a Task's When in place, leaving Threads and the count alone", () => {
    const task = makeTask();
    const thread = makeThread();
    const { result } = renderHook(() =>
      usePlanActions({ areas: [], threads: [thread] }),
    );
    const when = new Date(2026, 6, 20).getTime();

    result.current.planTask(task._id, when);
    expect(mocks.mutations.get("tasks:updateWhen")).toHaveBeenCalledWith({
      id: task._id,
      when,
    });

    const localStore = createLocalStore();
    localStore.set(api.tasks.list, {}, [task]);
    localStore.set(api.tasks.count, {}, 1);
    localStore.set(api.threads.list, {}, [thread]);

    optimisticFor("tasks:updateWhen")(localStore.store, {
      id: task._id,
      when,
    });

    expect(localStore.get(api.tasks.list, {})).toEqual([{ ...task, when }]);
    expect(localStore.get(api.tasks.count, {})).toBe(1);
    expect(localStore.get(api.threads.list, {})).toEqual([thread]);
  });
});
