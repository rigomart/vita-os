import type {
  AreaId,
  ApplicationError,
  TaskId,
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
  useTaskCommand,
  useCreateThread,
  useOpenThreads,
  useRemoveThread,
  useResolvedThreads,
  useUpdateThread,
} from "./hooks";

const health = anArea();
const home = anArea({
  _id: "area-2" as AreaId,
  name: "Home",
  slug: "home-0011aabb",
  order: 1,
});
const thread = aThread({
  tasks: [{ _id: "task-1" as TaskId, text: "Call clinic" }],
  focusedTaskId: "task-1" as TaskId,
});
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

describe("useResolvedThreads", () => {
  it("starts reading only when enabled", async () => {
    const resolved = aThread({ state: "resolved" });
    const client = createFakeApplicationClient({
      listResolvedThreads: async () => success([resolved]),
    });
    const { wrapper } = createHarness(client);
    const { result, rerender } = renderHook(
      ({ enabled }) => useResolvedThreads({ enabled }),
      {
        wrapper,
        initialProps: { enabled: false },
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual([resolved]));
  });

  it("refreshes resolved history after resolving, editing, reopening, and deleting a Thread", async () => {
    let stored: Thread | undefined = aThread();
    const client = createFakeApplicationClient({
      listResolvedThreads: async () =>
        success(stored?.state === "resolved" ? [stored] : []),
      updateThread: async ({
        threadId: _id,
        resolutionNote: _note,
        ...change
      }) => {
        stored = { ...stored!, ...change } as Thread;
        return success(stored);
      },
      removeThread: async () => {
        stored = undefined;
        return success({ acknowledged: true as const });
      },
    });
    const { wrapper } = createHarness(client);
    const { result } = renderHook(
      () => ({
        resolved: useResolvedThreads(),
        update: useUpdateThread(thread._id),
        remove: useRemoveThread(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.resolved.data).toEqual([]));
    await act(async () => {
      await result.current.update.mutateAsync({
        thread: stored!,
        state: "resolved",
      });
    });
    await waitFor(() =>
      expect(result.current.resolved.data?.[0]?.state).toBe("resolved"),
    );
    await act(async () => {
      await result.current.update.mutateAsync({
        thread: stored!,
        title: "Renamed history",
      });
    });
    await waitFor(() =>
      expect(result.current.resolved.data?.[0]?.title).toBe("Renamed history"),
    );
    await act(async () => {
      await result.current.update.mutateAsync({
        thread: stored!,
        state: "open",
      });
    });
    await waitFor(() => expect(result.current.resolved.data).toEqual([]));
    await act(async () => {
      await result.current.update.mutateAsync({
        thread: stored!,
        state: "resolved",
      });
    });
    await waitFor(() => expect(result.current.resolved.data).toHaveLength(1));
    await act(async () => {
      await result.current.remove.mutateAsync({ thread: stored! });
    });
    await waitFor(() => expect(result.current.resolved.data).toEqual([]));
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
  it("resolving drops the Thread from the open list and clears its attention", async () => {
    const attentive = aThread({
      tasks: [
        { _id: "task-1" as TaskId, text: "Call clinic" },
        { _id: "task-2" as TaskId, text: "Book appointment", date: 5_000 },
      ],
      focusedTaskId: "task-1" as TaskId,
    });
    const { tasks: _tasks, focusedTaskId: _focus, ...settled } = attentive;
    const client = createFakeApplicationClient({
      updateThread: async () =>
        success({
          ...settled,
          state: "resolved" as const,
        }),
    });
    const { wrapper, cache } = createHarness(
      client,
      seedThreadReads({ thread: attentive }),
    );
    const { result } = renderHook(() => useUpdateThread(thread._id), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ thread: attentive, state: "resolved" });
    });

    await waitFor(() => {
      expect(cache.getQueryData(queryKeys.threads.open())).toEqual([]);
      const rail = cache.getQueryData<ThreadDetail>(
        queryKeys.threads.detail(attentive.slug),
      );
      expect(rail?.thread.state).toBe("resolved");
      expect(rail?.thread.tasks).toBeUndefined();
      expect(rail?.thread.focusedTaskId).toBeUndefined();
      // A Resolved Thread keeps its Area.
      expect(rail?.thread.areaId).toBe(health._id);
      expect(rail?.area).toEqual(health);
    });
  });

  it("tasks the Thread to another Area and swaps the rail's Area", async () => {
    const client = createFakeApplicationClient({
      updateThread: async () => success({ ...thread, areaId: home._id }),
    });
    const { wrapper, cache } = createHarness(client, seedThreadReads());
    const { result } = renderHook(() => useUpdateThread(thread._id), {
      wrapper,
    });

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
    const { result } = renderHook(() => useUpdateThread(thread._id), {
      wrapper,
    });

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
    const { result } = renderHook(() => useUpdateThread(thread._id), {
      wrapper,
    });

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
    const { result } = renderHook(() => useUpdateThread(thread._id), {
      wrapper,
    });

    await act(async () => {
      await result.current
        .mutateAsync({ thread, title: "Something else" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.threads.detail(thread.slug))).toEqual(
      before.rail,
    );
    expect(cache.getQueryData(queryKeys.threads.open())).toEqual(before.open);
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

describe("Task rollback", () => {
  it("preserves a successful title edit when a Task edit fails", async () => {
    const pending = deferred<{ ok: false; error: ApplicationError }>();
    const { wrapper, cache } = createHarness(
      createFakeApplicationClient({
        updateThread: async (input) =>
          success({ ...thread, title: input.title! }),
      }),
      seedThreadReads(),
    );
    const { result } = renderHook(
      () => ({
        task: useTaskCommand<{
          threadId: ThreadId;
          taskId: TaskId;
          text: string;
        }>(thread, {
          run: () => pending.promise,
          change: (input) => ({
            kind: "edit",
            taskId: input.taskId,
            text: input.text,
          }),
        }),
        title: useUpdateThread(thread._id),
      }),
      { wrapper },
    );
    act(() =>
      result.current.task.mutate({
        threadId: thread._id,
        taskId: thread.tasks![0]!._id,
        text: "Pending Task edit",
      }),
    );
    await waitFor(() =>
      expect(
        cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]?.tasks?.[0]
          ?.text,
      ).toBe("Pending Task edit"),
    );
    await act(async () => {
      await result.current.title.mutateAsync({ thread, title: "Saved title" });
    });
    await act(async () => pending.resolve({ ok: false, error: unavailable }));
    await waitFor(() => expect(result.current.task.isError).toBe(true));
    for (const current of [
      cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0],
      cache.getQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug))
        ?.thread,
    ]) {
      expect(current?.title).toBe("Saved title");
      expect(current?.tasks).toEqual(thread.tasks);
    }
  });
});
