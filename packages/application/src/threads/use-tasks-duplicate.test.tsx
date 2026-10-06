import type {
  ApplicationClient,
  OperationResult,
  TaskId,
  Thread,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  failure,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useUpdateThread } from "./hooks";
import { useTasks } from "./use-tasks";

const alpha = { _id: "task-a" as TaskId, text: "Alpha" };
const beta = { _id: "task-b" as TaskId, text: "Beta" };
const gamma = { _id: "task-c" as TaskId, text: "Gamma" };
const initial = aThread({ tasks: [alpha, beta, gamma], revision: 4 });
const other = aThread({ _id: "thread-2" as ThreadId, slug: "other-thread" });

/** A service that holds one Thread and refuses a stale revision or a missing Task. */
function fakeService(
  options: {
    conflictOnce?: boolean;
    updateThread?: ApplicationClient["updateThread"];
  } = {},
) {
  let stored: Thread = initial;
  let refuseNext = options.conflictOnce ?? false;
  const write = (
    expectedRevision: number,
    taskId: TaskId,
    change: (thread: Thread) => Partial<Thread>,
  ): OperationResult<Thread> => {
    const refused =
      refuseNext ||
      expectedRevision !== stored.revision ||
      !stored.tasks?.some((task) => task._id === taskId);
    if (refused) {
      refuseNext = false;
      return failure({
        code: "conflict",
        message: "changed",
        retryable: false,
      });
    }
    stored = { ...stored, ...change(stored), revision: stored.revision + 1 };
    return success(stored);
  };
  const without = (thread: Thread, taskId: TaskId): Partial<Thread> => ({
    tasks: thread.tasks?.filter((task) => task._id !== taskId),
    ...(thread.focusedTaskId === taskId ? { focusedTaskId: undefined } : {}),
  });
  const removeTask = vi.fn(
    async (input: { taskId: TaskId; expectedRevision: number }) =>
      write(input.expectedRevision, input.taskId, (t) =>
        without(t, input.taskId),
      ),
  );
  const completeTask = vi.fn(
    async (input: { taskId: TaskId; expectedRevision: number }) =>
      write(input.expectedRevision, input.taskId, (t) =>
        without(t, input.taskId),
      ),
  );
  const editTask = vi.fn(
    async (input: { taskId: TaskId; text: string; expectedRevision: number }) =>
      write(input.expectedRevision, input.taskId, (t) => ({
        tasks: t.tasks?.map((task) =>
          task._id === input.taskId ? { ...task, text: input.text } : task,
        ),
      })),
  );
  const focusTask = vi.fn(
    async (input: { taskId: TaskId | null; expectedRevision: number }) =>
      write(input.expectedRevision, input.taskId ?? alpha._id, () => ({
        focusedTaskId: input.taskId ?? undefined,
      })),
  );
  const setTaskDate = vi.fn(
    async (input: {
      taskId: TaskId;
      date: number | null;
      expectedRevision: number;
    }) =>
      write(input.expectedRevision, input.taskId, (t) => ({
        tasks: t.tasks?.map((task) => {
          if (task._id !== input.taskId) return task;
          const { date: _date, ...undated } = task;
          return input.date === null
            ? undated
            : { ...undated, date: input.date };
        }),
      })),
  );
  const client: ApplicationClient = createFakeApplicationClient({
    listOpenThreads: async () => success([stored]),
    getThreadDetail: async () => success({ thread: stored, area: anArea() }),
    getThreadActivityPage: async () => success({ entries: [] }),
    removeTask,
    completeTask,
    editTask,
    focusTask,
    setTaskDate,
    ...(options.updateThread ? { updateThread: options.updateThread } : {}),
  });
  return {
    client,
    removeTask,
    completeTask,
    editTask,
    focusTask,
    setTaskDate,
  };
}

function renderTasks(client: ApplicationClient) {
  const feedback = { success: vi.fn(), error: vi.fn(), undoable: vi.fn() };
  const { cache, wrapper: Application } = createHarness(client, (cache) => {
    cache.setQueryData(queryKeys.threads.open(), [initial]);
    cache.setQueryData<ThreadDetail>(queryKeys.threads.detail(initial.slug), {
      thread: initial,
      area: anArea(),
    });
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const { result } = renderHook(() => useTasks(initial), { wrapper });
  const { result: update } = renderHook(() => useUpdateThread(initial._id), {
    wrapper,
  });
  // An edit to another Thread shares no queue with this one, but holds the
  // batch open while it is pending.
  const { result: updateOther } = renderHook(() => useUpdateThread(other._id), {
    wrapper,
  });
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  return { feedback, result, update, updateOther, open };
}

describe("a Task command the local rule already refuses", () => {
  // One activation of a button became dozens of commands. The first removed
  // the Task; each later one was refused with a conflict and toasted "This
  // Thread changed elsewhere", although nothing had changed elsewhere.
  it("is not sent when a Task is removed twice, and is not reported", async () => {
    const { client, removeTask } = fakeService();
    const { feedback, result } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.remove(beta._id),
        result.current.remove(beta._id),
        result.current.remove(beta._id),
      ]);
    });

    expect(removeTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("completes a Task once however often it is activated", async () => {
    const { client, completeTask } = fakeService();
    const { feedback, result, open } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.complete(alpha._id),
        result.current.complete(alpha._id),
        result.current.complete(alpha._id),
      ]);
    });

    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
    await waitFor(() => expect(open()?.tasks).toEqual([beta, gamma]));
  });

  it("does not send a focus that changes nothing", async () => {
    const { client, focusTask } = fakeService();
    const { feedback, result } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.focus(beta._id),
        result.current.focus(beta._id),
        result.current.focus(beta._id),
      ]);
    });

    expect(focusTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("does not send an edit to the text the Task already has", async () => {
    const { client, editTask } = fakeService();
    const { feedback, result, open } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.edit(beta._id, "Beta two"),
        result.current.edit(beta._id, "Beta two"),
      ]);
    });

    expect(editTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
    await waitFor(() => expect(open()?.tasks?.[1]?.text).toBe("Beta two"));
  });
});

describe("a Task's date through the same queue", () => {
  const date = new Date(2026, 6, 20, 15).getTime();

  it("shows at once, goes out once however often it is activated, and clears again", async () => {
    const { client, setTaskDate } = fakeService();
    const { feedback, result, open } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.setDate(beta._id, date),
        result.current.setDate(beta._id, date),
        result.current.setDate(beta._id, date),
      ]);
    });

    expect(setTaskDate).toHaveBeenCalledTimes(1);
    expect(setTaskDate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: beta._id, date, expectedRevision: 4 }),
    );
    expect(feedback.error).not.toHaveBeenCalled();
    await waitFor(() => expect(open()?.tasks?.[1]).toEqual({ ...beta, date }));

    await act(async () => {
      await result.current.setDate(beta._id, null);
    });
    await waitFor(() => expect(open()?.tasks?.[1]).toEqual(beta));
    expect(open()?.tasks?.[1]).not.toHaveProperty("date");
    expect(setTaskDate).toHaveBeenCalledTimes(2);
  });

  it("is refused quietly when the Task was removed behind it", async () => {
    const { client, removeTask, setTaskDate } = fakeService();
    const { result } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.remove(beta._id),
        result.current.setDate(beta._id, date),
      ]);
    });

    expect(removeTask).toHaveBeenCalledTimes(1);
    expect(setTaskDate).not.toHaveBeenCalled();
  });
});

describe("a Task command the local rule allows but the service refuses", () => {
  it("is sent once, reported once, and never re-sent", async () => {
    const { client, completeTask } = fakeService({ conflictOnce: true });
    const { feedback, result, open } = renderTasks(client);

    await act(async () => {
      await result.current.complete(alpha._id);
    });

    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.error).toHaveBeenCalledWith(
      "This Thread changed elsewhere. It has been refreshed.",
    );
    // The change rolled back and the read came back from the service.
    await waitFor(() => expect(open()?.tasks).toEqual([alpha, beta, gamma]));
    expect(completeTask).toHaveBeenCalledTimes(1);
  });
});

describe("a Task queue in which a command is refused", () => {
  it("drops the identical commands behind it, and still sends the others", async () => {
    const { client, completeTask, focusTask } = fakeService({
      conflictOnce: true,
    });
    const { feedback, result } = renderTasks(client);

    await act(async () => {
      await Promise.all([
        result.current.complete(alpha._id),
        result.current.complete(alpha._id),
        result.current.complete(alpha._id),
        result.current.focus(beta._id),
      ]);
    });

    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(focusTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).toHaveBeenCalledTimes(1);
  });
});

describe("a Task command issued beside another pending change to the Thread", () => {
  it("is sent after it, and lands, when that change is refused", async () => {
    const resolving = deferred<OperationResult<Thread>>();
    const { client, completeTask } = fakeService({
      updateThread: () => resolving.promise,
    });
    const { feedback, result, update, open } = renderTasks(client);

    act(() => {
      void update.current
        .mutateAsync({ thread: initial, state: "resolved" })
        .catch(() => undefined);
    });
    await waitFor(() => expect(open()).toBeUndefined());

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = result.current.complete(alpha._id);
    });
    // The edit moves the Thread's revision, so the Task command waits for it.
    expect(completeTask).not.toHaveBeenCalled();

    await act(async () => {
      resolving.resolve(
        failure({ code: "conflict", message: "changed", retryable: false }),
      );
      await completing;
    });
    expect(completeTask).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(open()?.tasks).toEqual([beta, gamma]));
    expect(feedback.error).not.toHaveBeenCalled();
  });
});

describe("what a Task queue remembers", () => {
  it("is forgotten once the queue drains, even while another command holds the batch open", async () => {
    const holding = deferred<OperationResult<Thread>>();
    const { client, focusTask } = fakeService({
      updateThread: () => holding.promise,
    });
    const { result, updateOther } = renderTasks(client);

    act(() => {
      void updateOther.current.mutateAsync({ thread: other, title: "Renamed" });
    });
    await act(async () => {
      await result.current.focus(beta._id);
    });
    expect(focusTask).toHaveBeenCalledTimes(1);

    // Another device may have unfocused it since; the queue has no say now.
    await act(async () => {
      await result.current.focus(beta._id);
    });
    expect(focusTask).toHaveBeenCalledTimes(2);

    holding.resolve(success(initial));
  });
});

describe("a dropped duplicate behind a refused command", () => {
  it("leaves no optimistic change behind while the batch is held open", async () => {
    const holding = deferred<OperationResult<Thread>>();
    const { client } = fakeService({
      conflictOnce: true,
      updateThread: () => holding.promise,
    });
    const { result, updateOther, open } = renderTasks(client);

    act(() => {
      void updateOther.current.mutateAsync({ thread: other, title: "Renamed" });
    });
    await act(async () => {
      await Promise.all([
        result.current.complete(alpha._id),
        result.current.complete(alpha._id),
      ]);
    });

    expect(open()?.tasks).toEqual([alpha, beta, gamma]);
    holding.resolve(success(initial));
  });
});
