import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  buildOptimisticThread,
  completeNextMove,
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

  it("resolves Threads out of open lists and clears follow-up details", () => {
    const thread = makeThread({
      slug: "book-checkup",
      nextMove: "Call clinic",
      followUp: 123,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [thread]);
    localStore.set(api.threads.listByArea, { areaId: thread.areaId }, [thread]);
    localStore.set(api.threads.get, { id: thread._id }, thread);
    localStore.set(api.threads.getBySlug, { slug: "book-checkup" }, thread);

    optimisticallyUpdateThread(
      localStore.store,
      {
        id: thread._id,
        state: "resolved",
        resolutionNote: "Clinic confirmed no further action",
      },
      { threadSlug: "book-checkup" },
    );

    expect(localStore.get(api.threads.list, {})).toEqual([]);
    expect(
      localStore.get(api.threads.listByArea, { areaId: thread.areaId }),
    ).toEqual([]);
    expect(localStore.get(api.threads.get, { id: thread._id })).toEqual({
      ...thread,
      state: "resolved",
      nextMove: undefined,
      followUp: undefined,
    });
  });

  it("moves a Thread between the two Area lists it belongs to", () => {
    const area1 = "area1" as Id<"areas">;
    const area2 = "area2" as Id<"areas">;
    const thread = makeThread({ slug: "book-checkup", areaId: area1 });
    const other = makeThread({
      _id: "thread2" as Id<"threads">,
      areaId: area2,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.list, {}, [thread]);
    localStore.set(api.threads.listByArea, { areaId: area1 }, [thread]);
    localStore.set(api.threads.listByArea, { areaId: area2 }, [other]);
    localStore.set(api.threads.getBySlug, { slug: "book-checkup" }, thread);

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, areaId: area2 },
      { threadSlug: "book-checkup" },
    );

    const moved = { ...thread, areaId: area2 };
    expect(localStore.get(api.threads.listByArea, { areaId: area1 })).toEqual(
      [],
    );
    expect(localStore.get(api.threads.listByArea, { areaId: area2 })).toEqual([
      other,
      moved,
    ]);
    expect(localStore.get(api.threads.list, {})).toEqual([moved]);
    expect(
      localStore.get(api.threads.getBySlug, { slug: "book-checkup" }),
    ).toEqual(moved);
  });

  it("resolves a Thread out of its Area list without landing it in another", () => {
    const area1 = "area1" as Id<"areas">;
    const area2 = "area2" as Id<"areas">;
    const thread = makeThread({ slug: "book-checkup", areaId: area1 });
    const other = makeThread({
      _id: "thread2" as Id<"threads">,
      areaId: area2,
    });
    const localStore = createLocalStore();

    localStore.set(api.threads.listByArea, { areaId: area1 }, [thread]);
    localStore.set(api.threads.listByArea, { areaId: area2 }, [other]);
    localStore.set(api.threads.getBySlug, { slug: "book-checkup" }, thread);

    optimisticallyUpdateThread(
      localStore.store,
      { id: thread._id, state: "resolved" },
      { threadSlug: "book-checkup" },
    );

    expect(localStore.get(api.threads.listByArea, { areaId: area1 })).toEqual(
      [],
    );
    expect(localStore.get(api.threads.listByArea, { areaId: area2 })).toEqual([
      other,
    ]);
  });
});
