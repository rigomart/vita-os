import type {
  OperationResult,
  TaskId,
  Thread,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  failure,
  success,
} from "../test/fake-application-client";
import { aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useTasks } from "./use-tasks";
import { useUpdateThread } from "./use-update-thread";

const alpha = { _id: "alpha" as TaskId, text: "Alpha" };
const beta = { _id: "beta" as TaskId, text: "Beta" };
const gamma = { _id: "gamma" as TaskId, text: "Gamma" };
const seed = aThread({ revision: 4, tasks: [alpha, beta, gamma] });
const other = aThread({
  _id: "thread-2" as ThreadId,
  slug: "other-thread",
  title: "Other",
});

/**
 * A service that holds one Thread and commits each command the moment it
 * arrives, refusing a Task command at a stale revision, but answers only when
 * the test opens that answer's gate. A Thread edit carries no revision and
 * always lands, moving the revision on.
 */
function gatedService() {
  let stored: Thread = seed;
  let flowing = false;
  const gates: Array<{ label: string; open: () => void }> = [];
  const refusals: string[] = [];
  const answer = <T,>(label: string, value: T): Promise<T> =>
    flowing
      ? Promise.resolve(value)
      : new Promise<T>((resolve) => {
          gates.push({ label, open: () => resolve(value) });
        });
  const conflict = (label: string, what: string) => {
    refusals.push(what);
    return answer(
      label,
      failure<Thread>({
        code: "conflict",
        message: "changed",
        retryable: false,
      }),
    );
  };

  const completeTask = vi.fn(
    (input: { taskId: TaskId; expectedRevision: number }) => {
      if (input.expectedRevision !== stored.revision) {
        return conflict(
          "completeTask",
          `complete ${input.taskId} at r${input.expectedRevision}`,
        );
      }
      stored = {
        ...stored,
        tasks: stored.tasks?.filter((task) => task._id !== input.taskId),
        revision: stored.revision + 1,
      };
      return answer("completeTask", success(stored));
    },
  );
  const focusTask = vi.fn(
    (input: { taskId: TaskId | null; expectedRevision: number }) => {
      if (input.expectedRevision !== stored.revision) {
        return conflict("focusTask", `focus at r${input.expectedRevision}`);
      }
      const { focusedTaskId: _focus, ...unfocused } = stored;
      stored = {
        ...unfocused,
        ...(input.taskId === null ? {} : { focusedTaskId: input.taskId }),
        revision: stored.revision + 1,
      };
      return answer("focusTask", success(stored));
    },
  );
  const updateThread = vi.fn(
    ({
      threadId,
      ...change
    }: UpdateThreadInput): Promise<OperationResult<Thread>> => {
      if (threadId !== stored._id) {
        return answer("other", success({ ...other, ...change } as Thread));
      }
      stored = {
        ...stored,
        ...(change.title === undefined ? {} : { title: change.title }),
        revision: stored.revision + 1,
      };
      return answer("updateThread", success(stored));
    },
  );

  return {
    client: createFakeApplicationClient({
      completeTask,
      focusTask,
      updateThread,
      listOpenThreads: async () => success([stored]),
      getThreadActivityPage: async () => success({ entries: [] }),
    }),
    completeTask,
    focusTask,
    updateThread,
    refusals,
    stored: () => stored,
    /** Open the earliest waiting answer with this label, if there is one. */
    release: (label: string) => {
      const index = gates.findIndex((gate) => gate.label === label);
      if (index < 0) return false;
      gates.splice(index, 1)[0]!.open();
      return true;
    },
    /** Answer everything waiting, and everything from now on, at once. */
    flowFreely: () => {
      flowing = true;
      for (const gate of gates.splice(0)) gate.open();
    },
  };
}

/** Let every command that can reach the service now do so. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

function setup(service: ReturnType<typeof gatedService>) {
  const feedback = { success: vi.fn(), error: vi.fn(), undoable: vi.fn() };
  const { cache, wrapper: Application } = createHarness(
    service.client,
    (cache) => cache.setQueryData(queryKeys.threads.open(), [seed]),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const { result: tasks } = renderHook(() => useTasks(seed), { wrapper });
  const { result: edit } = renderHook(() => useUpdateThread(seed), {
    wrapper,
  });
  const { result: editOther } = renderHook(() => useUpdateThread(other), {
    wrapper,
  });
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  return { feedback, tasks, edit, editOther, open };
}

describe("a Thread edit beside the Thread's Task queue", () => {
  // The issue's case: complete a Task, rename the Thread while that request
  // is in flight, then focus another Task before the queue drains. The focus
  // went out with the revision the completion brought back, which predates
  // the rename, and was refused as "changed elsewhere".
  it("issued while a Task command is in flight, does not make the next Task command stale", async () => {
    const service = gatedService();
    const { feedback, tasks, edit, open } = setup(service);

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = Promise.all([
        tasks.current.complete(alpha._id),
        edit.current({ title: "Renamed" }),
        tasks.current.focus(beta._id),
      ]);
    });
    await settle();
    service.flowFreely();
    await act(async () => {
      await pending;
    });

    expect(service.refusals).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
    expect(service.stored()).toMatchObject({
      title: "Renamed",
      tasks: [beta, gamma],
      focusedTaskId: beta._id,
    });
    await waitFor(() =>
      expect(open()).toMatchObject({
        title: "Renamed",
        tasks: [beta, gamma],
        focusedTaskId: beta._id,
        revision: service.stored().revision,
      }),
    );
  });

  it("still in flight when a Task command is issued, does not make that command stale", async () => {
    const service = gatedService();
    const { feedback, tasks, edit } = setup(service);

    let renaming: Promise<unknown> | undefined;
    act(() => {
      renaming = edit.current({ title: "Renamed" });
    });
    await settle();
    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.complete(alpha._id);
    });
    await settle();
    service.flowFreely();
    await act(async () => {
      await Promise.all([renaming, completing]);
    });

    expect(service.refusals).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
    expect(service.stored()).toMatchObject({
      title: "Renamed",
      tasks: [beta, gamma],
    });
  });

  it("once settled, gives the next Task command its revision while another command holds the batch open", async () => {
    const service = gatedService();
    const { feedback, tasks, edit, editOther } = setup(service);

    // An unrelated command keeps the reads from refetching.
    act(() => {
      void editOther.current({ title: "Elsewhere" });
    });
    let renaming: Promise<unknown> | undefined;
    act(() => {
      renaming = edit.current({ title: "Renamed" });
    });
    await settle();
    service.release("updateThread");
    await act(async () => {
      await renaming;
    });

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.complete(alpha._id);
    });
    await settle();
    service.release("completeTask");
    await act(async () => {
      await completing;
    });

    expect(service.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 5 }),
    );
    expect(service.refusals).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
    service.flowFreely();
  });
});
