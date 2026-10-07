import type {
  ApplicationClient,
  TaskId,
  OperationResult,
  Thread,
  ThreadDetail,
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
import { useCompleteTask, useTaskDates, useTasks } from "./use-tasks";

const callClinic = { _id: "task-1" as TaskId, text: "Call clinic" };
const bookSlot = { _id: "task-2" as TaskId, text: "Book slot" };
const thread = aThread({
  tasks: [callClinic, bookSlot],
  focusedTaskId: callClinic._id,
});

function render<T>(client: ApplicationClient, hook: () => T) {
  const feedback = {
    success: vi.fn(),
    error: vi.fn(),
    undoable: vi.fn(async () => true),
  };
  const { cache, wrapper: application } = createHarness(client, (cache) => {
    cache.setQueryData(queryKeys.threads.open(), [thread]);
    cache.setQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug), {
      thread,
      area: anArea(),
    });
  });
  const Application = application;
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const { result } = renderHook(hook, { wrapper });
  return { cache, feedback, result };
}

function shown(cache: ReturnType<typeof render>["cache"]) {
  return {
    open: cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0],
    rail: cache.getQueryData<ThreadDetail>(
      queryKeys.threads.detail(thread.slug),
    )?.thread,
  };
}

describe("useCompleteTask", () => {
  it("takes the Task off every read at once, and completing the Focused Task leaves the Thread unfocused", async () => {
    const pending = deferred<OperationResult<Thread>>();
    const completeTask = vi.fn(() => pending.promise);
    const { cache, result } = render(
      createFakeApplicationClient({ completeTask }),
      () => useCompleteTask(thread),
    );

    act(() => {
      void result.current(callClinic._id);
    });

    await waitFor(() => {
      const { open, rail } = shown(cache);
      expect(open?.tasks).toEqual([bookSlot]);
      expect(open).not.toHaveProperty("focusedTaskId");
      expect(rail?.tasks).toEqual([bookSlot]);
      expect(rail).not.toHaveProperty("focusedTaskId");
    });
    expect(completeTask).toHaveBeenCalledWith({
      threadId: thread._id,
      taskId: callClinic._id,
      expectedOccurrence: null,
      timeZone: expect.any(String),
    });

    await act(async () => {
      pending.resolve(
        success({
          ...thread,
          tasks: [bookSlot],
          focusedTaskId: undefined,

          lastActivityContent: 'Completed "Call clinic"',
        }),
      );
      await pending.promise;
    });
    await waitFor(() =>
      expect(shown(cache).open?.lastActivityContent).toBe(
        'Completed "Call clinic"',
      ),
    );
  });

  it("rolls a refused completion back and says why", async () => {
    const { cache, feedback, result } = render(
      createFakeApplicationClient({
        completeTask: async () =>
          failure({
            code: "conflict",
            message: "The Thread's Tasks have changed.",
            retryable: false,
          }),
        listOpenThreads: async () => success([thread]),
        getThreadDetail: async () => success({ thread, area: anArea() }),
        getThreadActivityPage: async () => success({ entries: [] }),
      }),
      () => useCompleteTask(thread),
    );

    await act(async () => {
      await result.current(bookSlot._id);
    });

    expect(shown(cache).open?.tasks).toEqual([callClinic, bookSlot]);
    expect(shown(cache).rail?.focusedTaskId).toBe(callClinic._id);
    expect(feedback.error).toHaveBeenCalledWith(
      "This Thread changed elsewhere. It has been refreshed.",
    );
  });
});

describe("useTaskDates", () => {
  it("adds one dated Follow up Task per accepted activation", async () => {
    const date = new Date(2026, 6, 20).getTime();
    const addTask = vi.fn(
      async (input: { taskId: TaskId; text: string; date?: number }) =>
        success({
          ...thread,
          tasks: [
            ...(thread.tasks ?? []),
            { _id: input.taskId, text: input.text, date },
          ],
        }),
    );
    const { cache, feedback, result } = render(
      createFakeApplicationClient({ addTask }),
      () => useTaskDates(thread),
    );

    await act(async () => {
      await result.current.addFollowUp(date);
    });

    expect(addTask).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
    expect(
      shown(cache).open?.tasks?.filter((task) => task.text === "Follow up"),
    ).toHaveLength(1);
  });
});

describe("useTasks", () => {
  it("focuses and unfocuses without reordering the list", async () => {
    const focusTask = vi.fn(async (input: { taskId: TaskId | null }) =>
      success({
        ...thread,
        ...(input.taskId === null
          ? { focusedTaskId: undefined }
          : { focusedTaskId: input.taskId }),
      }),
    );
    const { cache, result } = render(
      createFakeApplicationClient({ focusTask }),
      () => useTasks(thread),
    );

    await act(async () => {
      await result.current.focus(bookSlot._id);
    });
    expect(shown(cache).open?.focusedTaskId).toBe(bookSlot._id);
    expect(shown(cache).open?.tasks).toEqual([callClinic, bookSlot]);

    await act(async () => {
      await result.current.focus(null);
    });
    expect(shown(cache).rail).not.toHaveProperty("focusedTaskId");
    expect(focusTask).toHaveBeenLastCalledWith({
      threadId: thread._id,
      taskId: null,
    });
  });

  it("removes the Focused Task and clears the focus", async () => {
    const pending = deferred<OperationResult<Thread>>();
    const { cache, result } = render(
      createFakeApplicationClient({ removeTask: () => pending.promise }),
      () => useTasks(thread),
    );

    act(() => {
      void result.current.remove(callClinic._id);
    });

    await waitFor(() => {
      expect(shown(cache).rail?.tasks).toEqual([bookSlot]);
      expect(shown(cache).rail).not.toHaveProperty("focusedTaskId");
    });
    pending.resolve(success({ ...thread, tasks: [bookSlot] }));
  });

  it("captures nothing blank", async () => {
    const addTask = vi.fn();
    const { result } = render(createFakeApplicationClient({ addTask }), () =>
      useTasks(thread),
    );

    await act(async () => {
      await result.current.add("   ");
    });

    expect(addTask).not.toHaveBeenCalled();
  });
});
