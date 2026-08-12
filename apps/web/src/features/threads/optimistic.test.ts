import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  buildOptimisticThread,
  completeNextMove,
  optimisticallyRemoveThread,
  optimisticallyUpdateThread,
} from "./optimistic";

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

describe("Thread optimistic updates", () => {
  it("builds optimistic Threads without inventing a slug", () => {
    expect(
      buildOptimisticThread(
        {
          title: "Book checkup",
          summary: "Appointment scheduled",
          areaId: "area1" as Id<"areas">,
        },
        { id: "thread1" as Id<"threads">, now: 123, order: 4 },
      ),
    ).toEqual({
      _id: "thread1",
      _creationTime: 123,
      userId: "",
      title: "Book checkup",
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
      { thread },
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
    expect(
      localStore.get(api.threads.detailBySlug, { slug: "book-checkup" }),
    ).toEqual({ thread: moved, area: area1 });
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
