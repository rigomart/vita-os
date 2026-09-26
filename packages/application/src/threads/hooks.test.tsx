import type {
  AreaId,
  ApplicationError,
  Thread,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import {
  useCreateThread,
  useOpenThreads,
  useRemoveThread,
  useReplaceUpNext,
  useUpdateThread,
} from "./hooks";

const health = anArea();
const home = anArea({
  _id: "area-2" as AreaId,
  name: "Home",
  slug: "home-0011aabb",
  order: 1,
});
const thread = aThread({ nextMove: "Call clinic" });
const unavailable: ApplicationError = {
  code: "unavailable",
  message: "Temporarily unavailable.",
  retryable: true,
};

function seedThreadReads(overrides: { thread?: Thread } = {}) {
  const seeded = overrides.thread ?? thread;
  return (
    cache: Parameters<Parameters<typeof createHarness>[1] & object>[0],
  ) => {
    cache.setQueryData(queryKeys.threads.open(), [seeded]);
    cache.setQueryData<ThreadDetail>(queryKeys.threads.detail(seeded.slug), {
      thread: seeded,
      area: health,
    });
  };
}

describe("useOpenThreads", () => {
  it("reads the Open Threads", async () => {
    const client = createFakeApplicationClient({
      listOpenThreads: async () => success([thread]),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useOpenThreads(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([thread]));
  });
});

describe("useCreateThread", () => {
  it("shows the pending Thread in the open list", async () => {
    const stored = aThread({
      _id: "thread-stored" as ThreadId,
      title: "Refill prescription",
      slug: "refill-prescription-deadbeef",
      order: 1,
    });
    const pending = deferred<ReturnType<typeof success<Thread>>>();
    const client = createFakeApplicationClient({
      createThread: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useCreateThread(), { wrapper });

    act(() => {
      result.current.mutate({
        title: "Refill prescription",
        areaId: health._id,
      });
    });

    await waitFor(() => {
      expect(
        cache.getQueryData<Thread[]>(queryKeys.threads.open()),
      ).toHaveLength(2);
    });

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(
        cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[1],
      ).toEqual(stored),
    );
  });
});

describe("useCreateThread without an Area", () => {
  it("shows a pending Thread that carries no Area", async () => {
    const pending = deferred<ReturnType<typeof success<Thread>>>();
    const client = createFakeApplicationClient({
      createThread: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useCreateThread(), { wrapper });

    act(() => {
      result.current.mutate({ title: "Renew passport" });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[1],
      ).toMatchObject({ title: "Renew passport" }),
    );
    expect(
      cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[1],
    ).not.toHaveProperty("areaId");

    pending.resolve(success(aThread({ title: "Renew passport" })));
  });
});

describe("useUpdateThread", () => {
  it("promotes the front of Up Next when a change would empty the slot", async () => {
    const lined = aThread({
      nextMove: "Call clinic",
      upNext: ["Book appointment", "Collect results"],
    });
    const pending = deferred<ReturnType<typeof success<Thread>>>();
    const client = createFakeApplicationClient({
      updateThread: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(
      client,
      seedThreadReads({ thread: lined }),
    );
    const { result } = renderHook(() => useUpdateThread(), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ thread: lined, nextMove: null });
    });

    await waitFor(() => {
      const open = cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
      expect(open?.nextMove).toBe("Book appointment");
      expect(open?.upNext).toEqual(["Collect results"]);
    });
    expect(
      cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(lined.slug))
        ?.thread.nextMove,
    ).toBe("Book appointment");

    pending.resolve(
      success({
        ...lined,
        nextMove: "Book appointment",
        upNext: ["Collect results"],
      }),
    );
  });

  it("resolving drops the Thread from the open list and clears its attention", async () => {
    const attentive = aThread({
      nextMove: "Call clinic",
      upNext: ["Book appointment"],
      followUp: 5_000,
    });
    const client = createFakeApplicationClient({
      updateThread: async () =>
        success({ ...attentive, state: "resolved" as const }),
    });
    const { wrapper, cache } = createHarness(
      client,
      seedThreadReads({ thread: attentive }),
    );
    const { result } = renderHook(() => useUpdateThread(), { wrapper });

    act(() => {
      result.current.mutate({ thread: attentive, state: "resolved" });
    });

    await waitFor(() => {
      expect(cache.getQueryData(queryKeys.threads.open())).toEqual([]);
      const rail = cache.getQueryData<ThreadDetail>(
        queryKeys.threads.detail(attentive.slug),
      );
      expect(rail?.thread.state).toBe("resolved");
      expect(rail?.thread.nextMove).toBeUndefined();
      expect(rail?.thread.upNext).toBeUndefined();
      expect(rail?.thread.followUp).toBeUndefined();
      // A Resolved Thread keeps its Area.
      expect(rail?.thread.areaId).toBe(health._id);
      expect(rail?.area).toEqual(health);
    });
  });

  it("moves the Thread to another Area and swaps the rail's Area", async () => {
    const client = createFakeApplicationClient({
      updateThread: async () => success({ ...thread, areaId: home._id }),
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useUpdateThread(), { wrapper });

    act(() => {
      result.current.mutate({
        thread,
        areaId: home._id,
        destinationArea: home,
      });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug)),
      ).toMatchObject({ thread: { areaId: home._id }, area: home }),
    );
    expect(
      cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]?.areaId,
    ).toBe(home._id);
  });

  it("removes the Thread's Area everywhere it is shown", async () => {
    const { areaId: _removed, ...unlabeled } = thread;
    const client = createFakeApplicationClient({
      updateThread: async () => success(unlabeled),
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useUpdateThread(), { wrapper });

    act(() => {
      result.current.mutate({ thread, areaId: null });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug)),
      ).toEqual({ thread: unlabeled }),
    );
    expect(
      cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0],
    ).not.toHaveProperty("areaId");
  });

  it("labels an unlabeled Thread and gives the rail its Area", async () => {
    const { areaId: _removed, ...unlabeled } = thread;
    const client = createFakeApplicationClient({
      updateThread: async () => success({ ...unlabeled, areaId: home._id }),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.threads.open(), [unlabeled]);
      seeded.setQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug), {
        thread: unlabeled,
      });
    });
    const { result } = renderHook(() => useUpdateThread(), { wrapper });

    act(() => {
      result.current.mutate({
        thread: unlabeled,
        areaId: home._id,
        destinationArea: home,
      });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug))
          ?.area,
      ).toEqual(home),
    );
  });

  it("puts every read back when the change fails", async () => {
    const client = createFakeApplicationClient({
      updateThread: async () => ({ ok: false, error: unavailable }),
      listOpenThreads: async () => success([thread]),
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const before = {
      open: cache.getQueryData(queryKeys.threads.open()),
      rail: cache.getQueryData(queryKeys.threads.detail(thread.slug)),
    };
    const { result } = renderHook(() => useUpdateThread(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ thread, nextMove: "Something else" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.threads.detail(thread.slug))).toEqual(
      before.rail,
    );
    expect(cache.getQueryData(queryKeys.threads.open())).toEqual(before.open);
  });
});

describe("useReplaceUpNext", () => {
  it("rewrites the line everywhere the Thread is shown", async () => {
    const pending = deferred<ReturnType<typeof success<Thread>>>();
    const client = createFakeApplicationClient({
      replaceUpNext: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useReplaceUpNext(), { wrapper });

    act(() => {
      result.current.mutate({
        thread,
        moves: ["  Book appointment  ", "   ", "Collect results"],
      });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]?.upNext,
      ).toEqual(["Book appointment", "Collect results"]),
    );
    expect(
      cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug))
        ?.thread.upNext,
    ).toEqual(["Book appointment", "Collect results"]);

    pending.resolve(success(thread));
  });

  it("promotes the front move when the Thread has no Next Move", async () => {
    const empty = aThread();
    const pending = deferred<ReturnType<typeof success<Thread>>>();
    const client = createFakeApplicationClient({
      replaceUpNext: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(
      client,
      seedThreadReads({ thread: empty }),
    );
    const { result } = renderHook(() => useReplaceUpNext(), { wrapper });

    act(() => {
      result.current.mutate({
        thread: empty,
        moves: ["Book appointment", "Collect results"],
      });
    });

    await waitFor(() => {
      const open = cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
      expect(open?.nextMove).toBe("Book appointment");
      expect(open?.upNext).toEqual(["Collect results"]);
    });

    pending.resolve(success(empty));
  });
});

describe("useRemoveThread", () => {
  it("takes the Thread out of every read that held it", async () => {
    const client = createFakeApplicationClient({
      removeThread: async () => success({ acknowledged: true as const }),
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useRemoveThread(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ thread });
    });

    expect(cache.getQueryData(queryKeys.threads.open())).toEqual([]);
    expect(
      cache.getQueryData(queryKeys.threads.detail(thread.slug)),
    ).toBeNull();
  });
});
