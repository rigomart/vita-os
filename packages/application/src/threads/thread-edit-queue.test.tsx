import type {
  OperationResult,
  TaskId,
  Thread,
  ThreadId,
} from "@vita-os/contracts";

import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  failure,
  success,
} from "../test/fake-application-client";
import { aThread } from "../test/fixtures";
import {
  act,
  createTestQueryClient,
  renderHook,
  waitFor,
} from "../test/render-with-providers";
import { useUpdateThread } from "./hooks";
import { useTasks } from "./use-tasks";
const task = { _id: "task" as TaskId, text: "Call clinic" };
const first = aThread({ tasks: [task] });
const second = aThread({
  _id: "second" as ThreadId,
  slug: "second",
  title: "Second",
  tasks: [task],
});
describe("independent Thread edits and Task commands", () => {
  it("sends a Task command while a title edit is pending and preserves completion when that edit fails", async () => {
    const editing = deferred<OperationResult<Thread>>();
    const completeTask = vi.fn(async () => success({ ...first, tasks: [] }));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.threads.open(), [first]);
    const options = {
      queryClient,
      applicationClient: createQuietApplicationClient({
        updateThread: () => editing.promise,
        completeTask,
      }),
    };
    const { result: edit } = renderHook(
      () => useUpdateThread(first._id),
      options,
    );
    const { result: tasks } = renderHook(() => useTasks(first), options);
    act(() => edit.current.mutate({ thread: first, title: "Renamed" }));
    await waitFor(() =>
      expect(
        queryClient.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]
          ?.title,
      ).toBe("Renamed"),
    );
    await act(async () => {
      await tasks.current.complete(task._id);
    });
    expect(completeTask).toHaveBeenCalledExactlyOnceWith({
      threadId: first._id,
      taskId: task._id,
      expectedOccurrence: null,
      timeZone: expect.any(String),
    });
    await act(async () =>
      editing.resolve(
        failure({ code: "unavailable", message: "offline", retryable: true }),
      ),
    );
    await waitFor(() => expect(edit.current.isError).toBe(true));
    expect(
      queryClient.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]?.tasks,
    ).toEqual([]);
  });
  it("keeps each accepted command on its issued Thread when the surface switches Threads", async () => {
    const completing = deferred<OperationResult<Thread>>();
    const editing = deferred<OperationResult<Thread>>();
    const completeTask = vi.fn(() => completing.promise);
    const updateThread = vi.fn(() => editing.promise);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.threads.open(), [first, second]);
    const { result, rerender } = renderHook(
      ({ thread }) => ({
        tasks: useTasks(thread),
        edit: useUpdateThread(thread._id),
      }),
      {
        queryClient,
        applicationClient: createQuietApplicationClient({
          completeTask,
          updateThread,
        }),
        initialProps: { thread: first },
      },
    );
    act(() => {
      void result.current.tasks.complete(task._id);
      result.current.edit.mutate({ thread: first, title: "Renamed" });
    });
    rerender({ thread: second });
    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: first._id }),
    );
    expect(updateThread).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: first._id, title: "Renamed" }),
    );
    await act(async () => {
      completing.resolve(success({ ...first, tasks: [] }));
      editing.resolve(success({ ...first, title: "Renamed", tasks: [] }));
    });
    expect(
      queryClient
        .getQueryData<Thread[]>(queryKeys.threads.open())
        ?.find((thread) => thread._id === second._id),
    ).toEqual(second);
  });
});
