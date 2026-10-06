import type {
  AddNoteToThreadInput,
  Note,
  NoteAddedToThread,
  NoteId,
  TaskId,
  Thread,
  UpdateThreadInput,
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
  createFeedbackMock,
  createTestQueryClient,
  render,
  renderHook as renderWithProviders,
  screen,
  within,
} from "../../test/render-with-providers";
import { ThreadAttentionSection } from "../../threads/components/thread-attention-section";
import { useOpenThreads, useUpdateThread } from "../../threads/hooks";
import { settleTaskChange } from "../../threads/optimistic";
import { noteTaskId } from "../../threads/task-queue";
import { useTasks } from "../../threads/use-tasks";
import { useAddNoteToThread } from "./hooks";
import { useAddNoteToThreadWithUndo } from "./use-add-note-to-thread-with-undo";

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
function gatedService(seed: Thread) {
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
  const focusTask = vi.fn(
    (input: { taskId: TaskId | null; expectedRevision: number }) => {
      if (input.expectedRevision !== stored.revision) {
        refusals.push(`focus at r${input.expectedRevision}`);
        return answer(
          "focusTask",
          failure<Thread>({
            code: "conflict",
            message: "changed",
            retryable: false,
          }),
        );
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
  const setTaskDate = vi.fn(async () => {
    stored = { ...stored, revision: stored.revision + 1 };
    return success(stored);
  });
  // A Thread edit carries no revision: it always lands and moves it on.
  const updateThread = vi.fn((input: UpdateThreadInput) => {
    stored = {
      ...stored,
      ...(input.title === undefined ? {} : { title: input.title }),
      revision: stored.revision + 1,
    };
    return answer("updateThread", success(stored));
  });
  const client = createFakeApplicationClient({
    setTaskDate,
    completeTask,
    addTask,
    focusTask,
    addNoteToThread,
    listOpenThreads: async () => success([stored]),
    getThreadActivityPage: async () => success({ entries: [] }),
    updateThread,
  });

  return {
    client,
    setTaskDate,
    completeTask,
    addTask,
    focusTask,
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
  const { result: update } = renderHook(() => useUpdateThread(seed._id), {
    wrapper,
  });
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  return { feedback, add, tasks, update, open };
}

describe("Note conversions and the Task queue of one Thread", () => {
  it("sends a conversion only after the Task commands queued before it, and the next command carries the revision it left", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha, beta] });
    const service = gatedService(seed);
    const { feedback, add, tasks } = setup(service, seed);

    let completing: Promise<unknown> | undefined;
    await act(async () => {
      // A duplicate activation rides along: the queue still drops it.
      completing = Promise.all([
        tasks.current.complete(alpha._id),
        tasks.current.complete(alpha._id),
      ]);
    });
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await settle();
    expect(service.addNoteToThread).not.toHaveBeenCalled();

    service.flowFreely();
    await act(async () => {
      await completing;
    });
    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    expect(service.completeTask).toHaveBeenCalledTimes(1);
    expect(service.completeTask.mock.invocationCallOrder[0]!).toBeLessThan(
      service.addNoteToThread.mock.invocationCallOrder[0]!,
    );

    await act(async () => {
      await tasks.current.complete(noteTaskId(dentist));
    });
    expect(service.completeTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        taskId: noteTaskId(dentist),
        expectedRevision: 6,
      }),
    );
    expect(service.refusals).toEqual([]);
    expect(service.stored().tasks).toEqual([beta]);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("takes the Thread's whole Task state from a conversion's answer, focus included", async () => {
    const seed = aThread({
      revision: 4,
      tasks: [alpha],
      focusedTaskId: alpha._id,
    });
    const service = gatedService(seed);
    const { add, open } = setup(service, seed);
    service.flowFreely();
    // Another device unfocuses it; this one has not read that yet.
    service.elsewhere(({ focusedTaskId: _focus, ...thread }) => ({
      ...thread,
      revision: thread.revision + 1,
    }));

    await act(async () => {
      await add.current.mutateAsync({ note: dentist, thread: seed });
    });

    expect(open()?.revision).toBe(6);
    expect(open()?.focusedTaskId).toBeUndefined();
    expect(open()?.tasks?.map((task) => task._id)).toEqual([
      alpha._id,
      noteTaskId(dentist),
    ]);
  });

  it("lets a Thread edit run beside a conversion, and the Task command behind the edit carries the newest revision", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha, beta] });
    const service = gatedService(seed);
    const { feedback, add, tasks, update } = setup(service, seed);

    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await waitFor(() =>
      expect(service.addNoteToThread).toHaveBeenCalledTimes(1),
    );
    let renaming: Promise<unknown> | undefined;
    act(() => {
      renaming = update.current.mutateAsync({ thread: seed, title: "Renamed" });
    });
    await settle();
    expect(service.stored().revision).toBe(6);

    // The conversion answers first; the edit's answer is still on its way.
    service.release("addNoteToThread");
    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.complete(alpha._id);
    });
    await settle();
    expect(service.completeTask).not.toHaveBeenCalled();

    service.flowFreely();
    await act(async () => {
      await Promise.all([renaming, completing]);
    });
    expect(service.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: alpha._id, expectedRevision: 6 }),
    );
    expect(service.refusals).toEqual([]);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("never takes an older answer's Tasks, focus or revision over a newer read", () => {
    const newer = aThread({ revision: 7, tasks: [beta] });
    const { cache } = createHarness(createFakeApplicationClient(), (cache) =>
      cache.setQueryData(queryKeys.threads.open(), [newer]),
    );

    settleTaskChange(
      cache,
      aThread({ revision: 5, tasks: [alpha], focusedTaskId: alpha._id }),
    );

    expect(cache.getQueryData(queryKeys.threads.open())).toEqual([newer]);
  });
});

describe("a Thread while a Note is being added to it", () => {
  function Pane() {
    const thread = useOpenThreads().data?.[0];
    return thread ? <ThreadAttentionSection thread={thread} /> : null;
  }

  function renderPane(seed: Thread) {
    const service = gatedService(seed);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.threads.open(), [seed]);
    queryClient.setQueryData(queryKeys.notes.open(), [dentist, bill]);
    const feedback = createFeedbackMock();
    const providers = {
      applicationClient: service.client,
      queryClient,
      feedback,
    };
    render(<Pane />, providers);
    const { result: add } = renderWithProviders(
      () => useAddNoteToThread(),
      providers,
    );
    const { result: addWithUndo } = renderWithProviders(
      () => useAddNoteToThreadWithUndo(() => undefined),
      providers,
    );
    const row = (text: string) => screen.getByText(text).closest("li")!;
    const button = (text: string, name: RegExp) =>
      within(row(text)).getByRole("button", { name }) as HTMLButtonElement;
    const addInput = () =>
      screen.getByRole("textbox", { name: "Add a task" }) as HTMLInputElement;
    const locked = () =>
      addInput().disabled &&
      [...screen.getAllByRole("button")].every(
        (control) => (control as HTMLButtonElement).disabled,
      );
    return {
      service,
      add,
      addWithUndo,
      feedback,
      row,
      button,
      addInput,
      locked,
      queryClient,
    };
  }

  const busy = "A note is being added to this thread. Try again in a moment.";

  it("refuses a Task command that reaches a locked Thread anyway, with one toast and no request", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const service = gatedService(seed);
    const { feedback, add, tasks, open } = setup(service, seed);
    service.flowFreely();
    const undo = deferred<boolean>();

    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    await waitFor(() =>
      expect(open()?.tasks?.map((task) => task._id)).toContain(
        noteTaskId(dentist),
      ),
    );
    await act(async () => {
      await tasks.current.complete(alpha._id);
    });

    expect(service.completeTask).not.toHaveBeenCalled();
    expect(feedback.error).toHaveBeenCalledExactlyOnceWith(busy);
    expect(open()?.tasks?.map((task) => task._id)).toEqual([
      alpha._id,
      noteTaskId(dentist),
    ]);
    await act(async () => undo.resolve(true));
  });

  it("closes a date picker left open when the lock starts, so it cannot save", async () => {
    const user = userEvent.setup();
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const { service, add, button } = renderPane(seed);
    service.flowFreely();
    const undo = deferred<boolean>();

    await user.click(button("Alpha", /set date/i));
    await waitFor(() =>
      expect(document.querySelector("td[data-today] button")).not.toBeNull(),
    );
    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    await screen.findByText("Call the dentist");
    const day = document.querySelector<HTMLButtonElement>(
      "td[data-today] button",
    );
    if (day) await user.click(day);

    expect(day).toBeNull();
    expect(service.setTaskDate).not.toHaveBeenCalled();
    await act(async () => undo.resolve(true));
  });

  it("refuses a second Note into a Thread a Note is being added to, and keeps the first one pending", async () => {
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const { service, addWithUndo, feedback, row } = renderPane(seed);
    service.flowFreely();
    const undo = deferred<boolean>();
    vi.mocked(feedback.undoable).mockImplementationOnce(() => undo.promise);

    act(() => {
      void addWithUndo.current(dentist, seed);
    });
    await screen.findByText("Call the dentist");
    await act(async () => {
      await addWithUndo.current(bill, seed);
    });

    expect(feedback.error).toHaveBeenCalledExactlyOnceWith(busy);
    expect(service.addNoteToThread).not.toHaveBeenCalled();
    expect(screen.queryByText("Pay the bill")).toBeNull();
    expect(within(row("Call the dentist")).getByText("Adding…")).toBeTruthy();

    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(within(row("Call the dentist")).queryByText("Adding…")).toBeNull(),
    );
    expect(service.addNoteToThread).toHaveBeenCalledTimes(1);
    expect(service.addNoteToThread).toHaveBeenCalledWith(
      expect.objectContaining({ noteId: dentist._id }),
    );
  });

  it("takes no Task command until the conversion settles, and shows its Task as pending", async () => {
    const user = userEvent.setup();
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const { service, add, row, button, locked } = renderPane(seed);
    service.flowFreely();
    const undo = deferred<boolean>();

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
    expect(row("Alpha").getAttribute("aria-busy")).toBeNull();
    expect(locked()).toBe(true);
    await user.click(button("Alpha", /complete task/i));
    expect(service.completeTask).not.toHaveBeenCalled();

    await act(async () => undo.resolve(true));
    await waitFor(() => expect(locked()).toBe(false));
    expect(within(row("Call the dentist")).queryByText("Adding…")).toBeNull();

    await user.click(button("Call the dentist", /complete task/i));
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    expect(service.completeTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        taskId: noteTaskId(dentist),
        expectedRevision: 5,
      }),
    );
    expect(service.refusals).toEqual([]);
  });

  // Once, with a completion held, a Task added behind it and a Note
  // converted after both, the added Task vanished until its own answer.
  it("keeps Tasks queued before the conversion in view while each goes out ahead of it", async () => {
    const user = userEvent.setup();
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const { service, add, button, addInput, locked } = renderPane(seed);

    await user.click(button("Alpha", /complete task/i));
    await waitFor(() => expect(service.completeTask).toHaveBeenCalledTimes(1));
    await user.type(addInput(), "Beta{Enter}");
    await screen.findByText("Beta");
    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await screen.findByText("Call the dentist");
    expect(locked()).toBe(true);

    await act(async () => {
      service.release("completeTask");
    });
    await waitFor(() => expect(service.addTask).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(service.addNoteToThread).not.toHaveBeenCalled();

    await act(async () => {
      service.release("addTask");
    });
    await waitFor(() =>
      expect(service.addNoteToThread).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Call the dentist")).toBeTruthy();

    await act(async () => {
      service.release("addNoteToThread");
    });
    await waitFor(() => expect(locked()).toBe(false));
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Call the dentist")).toBeTruthy();
    expect(service.stored().revision).toBe(7);
    expect(service.refusals).toEqual([]);
  });

  // Once, a focus made during the Undo window was lost: the conversion's
  // newer answer left focus out, and the focus answer was older.
  it("takes no focus during the Undo window, and keeps one made after it", async () => {
    const user = userEvent.setup();
    const seed = aThread({ revision: 4, tasks: [alpha] });
    const { service, add, button, locked, queryClient } = renderPane(seed);
    service.flowFreely();
    const undo = deferred<boolean>();

    act(() => {
      add.current.mutate({
        note: dentist,
        thread: seed,
        undoWindow: () => undo.promise,
      });
    });
    await screen.findByText("Call the dentist");
    expect(button("Alpha", /focus this task/i).disabled).toBe(true);
    await user.click(button("Alpha", /focus this task/i));
    expect(service.focusTask).not.toHaveBeenCalled();

    await act(async () => undo.resolve(true));
    await waitFor(() => expect(locked()).toBe(false));
    await user.click(button("Alpha", /focus this task/i));
    await waitFor(() =>
      expect(
        button("Alpha", /unfocus this task/i).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]
          ?.focusedTaskId,
      ).toBe(alpha._id),
    );
    expect(service.focusTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: alpha._id, expectedRevision: 5 }),
    );
    expect(service.refusals).toEqual([]);
  });
});
