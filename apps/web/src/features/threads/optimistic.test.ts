import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";
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
    set(query: unknown, args: unknown, value: unknown) {
      entries.push({ query: queryKey(query), args, value });
    },
    get(query: unknown, args: unknown) {
      return findEntry(query, args)?.value;
    },
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
});
