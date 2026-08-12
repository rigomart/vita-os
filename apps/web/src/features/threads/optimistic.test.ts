import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  buildOptimisticThread,
  completeNextMove,
  optimisticallyRemoveThread,
  optimisticallyUpdateThread,
} from "./optimistic";

function makeThread(overrides: Partial<ProjectedThread> = {}): ProjectedThread {
  return {
    _id: "thread1" as Id<"threads">,
    title: "Book checkup",
    slug: "book-checkup",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function makeArea(id: string, slug: string): ProjectedArea {
  return {
    _id: id as Id<"areas">,
    name: id,
    slug,
    icon: "Compass",
    condition: "healthy",
    order: 0,
    createdAt: 0,
  };
}

describe("Thread optimistic updates", () => {
  it("builds optimistic Threads with a server-shaped temporary slug", () => {
    const thread = buildOptimisticThread(
      {
        title: "Book checkup",
        summary: "Appointment scheduled",
        areaId: "area1" as Id<"areas">,
      },
      { id: "thread1" as Id<"threads">, now: 123, order: 4 },
    );

    // The suffix is random, so the slug is asserted by shape: the same
    // `slugified-title-8hex` the server mints.
    expect(thread.slug).toMatch(/^book-checkup-[0-9a-f]{8}$/);
    expect(thread).toEqual({
      _id: "thread1",
      title: "Book checkup",
      slug: thread.slug,
      summary: "Appointment scheduled",
      areaId: "area1",
      order: 4,
      state: "open",
      createdAt: 123,
    });
  });

  it("clears the next move when completed", () => {
    const thread = makeThread({ nextMove: "Call clinic" });

    expect(completeNextMove(thread)).toEqual({
      ...thread,
      nextMove: undefined,
    });
  });

  it("resolves Threads out of the open list and their Area page, keeping the rail current", () => {
    const area = makeArea("area1", "family-health");
    const otherArea = makeArea("area2", "work");
    const other = makeThread({
      _id: "thread2" as Id<"threads">,
      areaId: otherArea._id,
    });
    const thread = makeThread({
      slug: "book-checkup",
      nextMove: "Call clinic",
      followUp: 123,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [thread]);
    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [thread] },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: "work" },
      { area: otherArea, threads: [other] },
    );

    optimisticallyUpdateThread(
      localStore.store,
      {
        id: thread._id,
        state: "resolved",
        resolutionNote: "Clinic confirmed no further action",
      },
      { thread },
    );

    const resolved = {
      ...thread,
      state: "resolved",
      nextMove: undefined,
      followUp: undefined,
    };
    expect(localStore.get(api.threads.list, {})).toEqual([]);
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: resolved, area });
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area, threads: [] });
    expect(localStore.get(api.areas.detailBySlug, { slug: "work" })).toEqual({
      area: otherArea,
      threads: [other],
    });
  });

  it("moves a Thread between the two cached Area pages", () => {
    const area1 = makeArea("area1", "family-health");
    const area2 = makeArea("area2", "work");
    const thread = makeThread({ slug: "book-checkup", areaId: area1._id });
    const other = makeThread({
      _id: "thread2" as Id<"threads">,
      areaId: area2._id,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [thread]);
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area: area1, threads: [thread] },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: "work" },
      { area: area2, threads: [other] },
    );
    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area: area1 },
    );

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, areaId: area2._id },
      { thread, destinationArea: area2 },
    );

    const moved = { ...thread, areaId: area2._id };
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area: area1, threads: [] });
    expect(localStore.get(api.areas.detailBySlug, { slug: "work" })).toEqual({
      area: area2,
      threads: [other, moved],
    });
    expect(localStore.get(api.threads.list, {})).toEqual([moved]);
    // The rail's embedded Area follows the move, so a rename in the window
    // before the round-trip lands navigates to the destination's slug.
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: moved, area: area2 });
  });

  it("leaves the rail's Area alone when the destination document is not provided", () => {
    const area1 = makeArea("area1", "family-health");
    const area2 = makeArea("area2", "work");
    const thread = makeThread({ slug: "book-checkup", areaId: area1._id });
    const localStore = createLocalStore();

    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area: area1 },
    );

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, areaId: area2._id },
      { thread },
    );

    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: { ...thread, areaId: area2._id }, area: area1 });
  });

  it("reopens a resolved Thread back into the open-only caches, in order", () => {
    const area = makeArea("area1", "family-health");
    const before = makeThread({
      _id: "thread0" as Id<"threads">,
      order: 0,
      createdAt: 10,
    });
    const after = makeThread({
      _id: "thread2" as Id<"threads">,
      order: 2,
      createdAt: 30,
    });
    const thread = makeThread({
      slug: "book-checkup",
      state: "resolved",
      order: 1,
      createdAt: 20,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [before, after]);
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [before, after] },
    );
    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area },
    );

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, state: "open" },
      { thread },
    );

    const reopened = { ...thread, state: "open" };
    expect(localStore.get(api.threads.list, {})).toEqual([
      before,
      reopened,
      after,
    ]);
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area, threads: [before, reopened, after] });
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: reopened, area });
  });

  it("does not resurrect a missing Thread on an ordinary field patch", () => {
    const area = makeArea("area1", "family-health");
    const other = makeThread({ _id: "thread2" as Id<"threads"> });
    const thread = makeThread({ slug: "book-checkup" });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [other]);
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [other] },
    );

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, nextMove: "Call clinic" },
      { thread },
    );

    expect(localStore.get(api.threads.list, {})).toEqual([other]);
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area, threads: [other] });
  });

  it("inserts into the destination Area page when the previous one is uncached", () => {
    const area2 = makeArea("area2", "work");
    const thread = makeThread({ slug: "book-checkup" });
    const localStore = createLocalStore();

    localStore.set(
      api.areas.detailBySlug,
      { slug: "work" },
      { area: area2, threads: [] },
    );

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, areaId: area2._id },
      { thread },
    );

    expect(localStore.get(api.areas.detailBySlug, { slug: "work" })).toEqual({
      area: area2,
      threads: [{ ...thread, areaId: area2._id }],
    });
  });

  it("removes a deleted Thread from the list, the rail and its Area page", () => {
    const area = makeArea("area1", "family-health");
    const thread = makeThread({ slug: "book-checkup" });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [thread]);
    localStore.set(
      api.threads.detailBySlug,
      { slug: "book-checkup" },
      { thread, area },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [thread] },
    );

    optimisticallyRemoveThread(
      localStore.store,
      { id: thread._id },
      { thread },
    );

    expect(localStore.get(api.threads.list, {})).toEqual([]);
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toBe(null);
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area, threads: [] });
  });
});
