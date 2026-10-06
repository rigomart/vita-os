import type {
  AddNoteToThreadInput,
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { taskFromNote } from "@vita-os/core";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  failure,
  success,
} from "../../test/fake-application-client";
import { aThread, aThreadNote } from "../../test/fixtures";
import { createHarness } from "../../test/harness";
import {
  createTestQueryClient,
  render,
  renderHook as renderWithProviders,
  screen,
  within,
} from "../../test/render-with-providers";
import { ThreadAttentionSection } from "../../threads/components/thread-attention-section";
import { useOpenThreads, useUpdateThread } from "../../threads/hooks";
import { noteTaskId } from "../../threads/task-queue";
import { useTasks } from "../../threads/use-tasks";
import { useAddNoteToThread } from "./hooks";

const date = new Date(2026, 6, 23, 15).getTime();
const dentist: Note = {
  _id: "dentist" as NoteId,
  body: "Call the dentist",
  followUp: date,
  state: "open",
  createdAt: 1_000,
};
const bill: Note = { ...dentist, _id: "bill" as NoteId, body: "Pay the bill" };
const alpha = { _id: "alpha" as TaskId, text: "Alpha" };
const beta = { _id: "beta" as TaskId, text: "Beta" };

/**
 * A service that holds one Thread, commits each command the moment it arrives
 * and refuses a stale revision or a missing Task, but answers only when the
 * test opens that answer's gate: a reply can be late although the write landed.
 */
function gatedService(
  seed: Thread,
  updateThread?: () => Promise<OperationResult<Thread>>,
) {
  let stored = seed;
  let flowing = false;
  const gates: Array<{ label: string; open: () => void }> = [];
  const refusals: string[] = [];
  const answer = <T,>(label: string, value: T): Promise<T> =>
    flowing
      ? Promise.resolve(value)
      : new Promise<T>((resolve) => {
          gates.push({ label, open: () => resolve(value) });
        });

  const completeTask = vi.fn(
    (input: { taskId: TaskId; expectedRevision: number }) => {
      if (
        input.expectedRevision !== stored.revision ||
        !stored.tasks?.some((task) => task._id === input.taskId)
      ) {
        refusals.push(`complete ${input.taskId} at r${input.expectedRevision}`);
        return answer(
          "completeTask",
          failure<Thread>({
            code: "conflict",
            message: "changed",
            retryable: false,
          }),
        );
      }
      stored = {
        ...stored,
        tasks: stored.tasks.filter((task) => task._id !== input.taskId),
        revision: stored.revision + 1,
      };
      return answer("completeTask", success(stored));
    },
  );
  const addNoteToThread = vi.fn((input: AddNoteToThreadInput) => {
    const note = [dentist, bill].find((n) => n._id === input.noteId)!;
    const task = taskFromNote(note, input.taskId!)!;
    stored = {
      ...stored,
      tasks: [...(stored.tasks ?? []), task],
      revision: stored.revision + 1,
    };
    return answer(
      "addNoteToThread",
      success<NoteAddedToThread>({
        thread: stored,
        threadNote: aThreadNote(),
      }),
    );
  });
  const addTask = vi.fn(
    (input: { taskId: TaskId; text: string; expectedRevision: number }) => {
      if (input.expectedRevision !== stored.revision) {
        refusals.push(`add ${input.text} at r${input.expectedRevision}`);
        return answer(
          "addTask",
          failure<Thread>({
            code: "conflict",
            message: "changed",
            retryable: false,
          }),
        );
      }
      stored = {
        ...stored,
        tasks: [
          ...(stored.tasks ?? []),
          { _id: input.taskId, text: input.text },
        ],
        revision: stored.revision + 1,
      };
      return answer("addTask", success(stored));
    },
  );
  const client = createFakeApplicationClient({
    completeTask,
    addTask,
    addNoteToThread,
    listOpenThreads: async () => success([stored]),
    getThreadActivityPage: async () => success({ entries: [] }),
    ...(updateThread === undefined ? {} : { updateThread }),
  });

  return {
    client,
    completeTask,
    addNoteToThread,
    refusals,
    stored: () => stored,
    /** A change another device makes. */
    elsewhere: (change: (thread: Thread) => Thread) => {
      stored = change(stored);
    },
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

function setup(service: ReturnType<typeof gatedService>, seed: Thread) {
  const feedback = { success: vi.fn(), error: vi.fn(), undoable: vi.fn() };
  const { cache, wrapper: Application } = createHarness(
    service.client,
    (cache) => {
      cache.setQueryData(queryKeys.threads.open(), [seed]);
      cache.setQueryData(queryKeys.notes.open(), [dentist, bill]);
    },
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
  const { result: tasks } = renderHook(() => useTasks(seed), { wrapper });
  const { result: update } = renderHook(() => useUpdateThread(), { wrapper });
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  return { feedback, add, tasks, update, open };
}

describe("Note conversions and the Task queue of one Thread", () => {
  // Once, the conversion answered at r6 before an earlier completion
  // answered at r5, and the late r5 became the basis, so completing the
  // converted Task was silently dropped.
  it("does not let a late Task answer replace a newer basis", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const service = gatedService(seed);
    const { feedback, add, tasks } = setup(service, seed);
    const converted = noteTaskId(dentist);

    await act(async () => {
      void tasks.current.complete(alpha._id);
    });
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await settle();
    if (service.release("addNoteToThread")) {
      await waitFor(() => expect(add.current.isSuccess).toBe(true));
    }
    let completing: Promise<void> | undefined;
    await act(async () => {
      completing = tasks.current.complete(converted);
    });
    await act(async () => {
      service.flowFreely();
      await completing;
    });

    expect(service.completeTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ taskId: converted }),
    );
    expect(service.refusals).toEqual([]);
    expect(service.stored().tasks).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  // Once, clearing the basis when the conversion settled let a duplicate
  // completion through to the service, which refused it with a false toast.
  it("still drops a duplicate completion queued across a conversion", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha, beta] });
    const service = gatedService(seed);
    const { feedback, add, tasks } = setup(service, seed);
    const undo = deferred<boolean>();

    await act(async () => {
      void tasks.current.complete(alpha._id);
    });
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    let duplicate: Promise<void> | undefined;
    await act(async () => {
      duplicate = tasks.current.complete(alpha._id);
    });
    service.flowFreely();
    await act(async () => undo.resolve(true));
    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    await act(async () => {
      await duplicate;
    });

    expect(service.completeTask).toHaveBeenCalledTimes(1);
    expect(service.refusals).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  // Once, two conversions replayed r6 then r5 while another command held
  // the batch open, so the Tasks reverted to r5 under revision r6.
  it("never shows older Tasks under a newer revision", async () => {
    const seed = aThread({ revision: 4, tasks: [] });
    const holding = deferred<OperationResult<Thread>>();
    const service = gatedService(seed, () => holding.promise);
    const { add, update, open } = setup(service, seed);
    const undo = deferred<boolean>();
    service.flowFreely();

    act(() => {
      void update.current
        .mutateAsync({ thread: seed, title: "Renamed" })
        .catch(() => undefined);
    });
    // Issued first, but held by its Undo window: it lands second.
    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    await act(async () => {
      await add.current.mutateAsync({ note: bill, thread: seed });
    });
    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(service.addNoteToThread).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(open()?.revision).toBe(6));

    expect(service.stored().revision).toBe(6);
    expect(open()?.tasks?.map((task) => task._id)).toEqual(
      service.stored().tasks?.map((task) => task._id),
    );
    holding.resolve(success(seed));
  });

  // Once, a settled Task add replayed its optimistic change after a newer
  // answer, bringing back a Task another device had removed.
  it("never replays a settled change over a newer answer", async () => {
    const seed = aThread({ revision: 4, tasks: [] });
    const holding = deferred<OperationResult<Thread>>();
    const service = gatedService(seed, () => holding.promise);
    const { add, tasks, update, open } = setup(service, seed);
    const undo = deferred<boolean>();
    service.flowFreely();

    act(() => {
      void update.current
        .mutateAsync({ thread: seed, title: "Renamed" })
        .catch(() => undefined);
    });
    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    await act(async () => {
      await tasks.current.add("Alpha");
    });
    expect(service.stored().revision).toBe(5);
    service.elsewhere((thread) => ({
      ...thread,
      tasks: [],
      revision: thread.revision + 1,
    }));
    await act(async () => undo.resolve(true));
    await waitFor(() => expect(open()?.revision).toBe(7));

    expect(open()?.tasks?.map((task) => task._id)).toEqual([
      noteTaskId(dentist),
    ]);
    holding.resolve(success(seed));
  });

  // Once, a Task command waited on conversion A only; B committed r6
  // meanwhile, A released it at r5, and it was refused as stale.
  it("sends a Task command with the revision a later conversion left", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const service = gatedService(seed);
    const { feedback, add, tasks } = setup(service, seed);

    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await waitFor(() =>
      expect(service.addNoteToThread).toHaveBeenCalledTimes(1),
    );
    let completing: Promise<void> | undefined;
    await act(async () => {
      completing = tasks.current.complete(alpha._id);
    });
    act(() => {
      add.current.mutate({ note: bill, thread: seed });
    });
    await settle();
    await act(async () => {
      service.release("addNoteToThread");
    });
    await act(async () => {
      service.flowFreely();
      await completing;
    });

    expect(service.completeTask).toHaveBeenCalledTimes(1);
    expect(service.refusals).toEqual([]);
    expect(service.stored().tasks?.map((task) => task._id)).toEqual([
      noteTaskId(dentist),
      noteTaskId(bill),
    ]);
    expect(feedback.error).not.toHaveBeenCalled();
  });
});

describe("the Task a pending conversion shows", () => {
  function Pane() {
    const thread = useOpenThreads().data?.[0];
    return thread ? <ThreadAttentionSection thread={thread} /> : null;
  }

  it("is pending and takes no command until the conversion commits, while the Thread's other Tasks stay usable", async () => {
    const user = userEvent.setup();
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const service = gatedService(seed);
    service.flowFreely();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.threads.open(), [seed]);
    queryClient.setQueryData(queryKeys.notes.open(), [dentist]);
    const providers = { applicationClient: service.client, queryClient };
    render(<Pane />, providers);
    const { result: add } = renderWithProviders(
      () => useAddNoteToThread(),
      providers,
    );
    const undo = deferred<boolean>();
    const row = (text: string) => screen.getByText(text).closest("li")!;
    const button = (text: string, name: RegExp) =>
      within(row(text)).getByRole("button", { name }) as HTMLButtonElement;

    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });

    await screen.findByText("Call the dentist");
    expect(within(row("Call the dentist")).getByText("Adding…")).toBeTruthy();
    expect(row("Call the dentist").getAttribute("aria-busy")).toBe("true");
    for (const name of [/complete task/i, /remove task/i, /focus this task/i]) {
      expect(button("Call the dentist", name).disabled).toBe(true);
    }

    // Another Task completes during the Undo window. Its answer cannot hold
    // the converted Task, which stays on screen all the same.
    await user.click(button("Alpha", /complete task/i));
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(screen.getByText("Call the dentist")).toBeTruthy();

    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(button("Call the dentist", /complete task/i).disabled).toBe(false),
    );
    expect(within(row("Call the dentist")).queryByText("Adding…")).toBeNull();

    await user.click(button("Call the dentist", /complete task/i));
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(2));
    expect(service.completeTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        taskId: noteTaskId(dentist),
        expectedRevision: 6,
      }),
    );
    expect(service.refusals).toEqual([]);
  });
});
