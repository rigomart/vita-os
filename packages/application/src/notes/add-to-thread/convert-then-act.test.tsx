import type {
  ApplicationClient,
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../../test/fake-application-client";
import { aThread, aThreadNote } from "../../test/fixtures";
import { createHarness } from "../../test/harness";
import { noteTaskId, usePendingTaskIds } from "../../threads/task-queue";
import { useTasks } from "../../threads/use-tasks";
import { useAddNoteToThread, useCreateThreadFromNote } from "./hooks";

const date = new Date(2026, 6, 23, 15).getTime();
const note: Note = {
  _id: "dated-note" as NoteId,
  body: "Call the dentist",
  followUp: date,
  state: "open",
  createdAt: 1_000,
};
const thread = aThread({ revision: 4 });

describe("a Task made by adding a Note to a Thread", () => {
  it("is named once, pending through the Undo window and the request, then completed against the revision the conversion left", async () => {
    const undo = deferred<boolean>();
    const conversion = deferred<OperationResult<NoteAddedToThread>>();
    const taskId = noteTaskId(note);
    const addNoteToThread = vi.fn(() => conversion.promise);
    const completeTask = vi.fn(async (input: { expectedRevision: number }) =>
      success<Thread>({ ...thread, revision: input.expectedRevision + 1 }),
    );
    const client = createFakeApplicationClient({
      addNoteToThread,
      completeTask,
      getThreadActivityPage: async () => success({ entries: [] }),
    });
    const { wrapper: Application } = createHarness(client, (cache) => {
      cache.setQueryData(queryKeys.threads.open(), [thread]);
      cache.setQueryData(queryKeys.notes.open(), [note]);
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <Application>
        <FeedbackProvider
          feedback={{ success: vi.fn(), error: vi.fn(), undoable: vi.fn() }}
        >
          {children}
        </FeedbackProvider>
      </Application>
    );
    const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
    const { result: tasks } = renderHook(() => useTasks(thread), { wrapper });
    const { result: pending } = renderHook(() => usePendingTaskIds(), {
      wrapper,
    });

    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undo.promise });
    });
    // Nothing reaches the service while the Undo window is open, and the
    // Task it shows is pending.
    await waitFor(() => expect(pending.current.has(taskId)).toBe(true));
    expect(addNoteToThread).not.toHaveBeenCalled();

    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(addNoteToThread).toHaveBeenCalledExactlyOnceWith({
        noteId: note._id,
        threadId: thread._id,
        taskId,
      }),
    );
    expect(pending.current.has(taskId)).toBe(true);

    await act(async () =>
      conversion.resolve(
        success<NoteAddedToThread>({
          thread: {
            ...thread,
            tasks: [{ _id: taskId, text: "Call the dentist", date }],
            revision: 5,
          },
          threadNote: aThreadNote(),
        }),
      ),
    );
    await waitFor(() => expect(pending.current.size).toBe(0));

    await act(async () => {
      await tasks.current.complete(taskId);
    });
    expect(completeTask).toHaveBeenCalledExactlyOnceWith({
      threadId: thread._id,
      taskId,
      expectedRevision: 5,
    });
  });
});

const second: Note = {
  ...note,
  _id: "second-note" as NoteId,
  body: "Pay the bill",
};

function setup(client: ApplicationClient, seed: Thread = thread) {
  const { cache, wrapper: Application } = createHarness(client, (cache) => {
    cache.setQueryData(queryKeys.threads.open(), [seed]);
    cache.setQueryData(queryKeys.notes.open(), [note, second]);
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider
        feedback={{ success: vi.fn(), error: vi.fn(), undoable: vi.fn() }}
      >
        {children}
      </FeedbackProvider>
    </Application>
  );
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  return { cache, wrapper, open };
}

const added = (tasks: NonNullable<Thread["tasks"]>, revision: number) =>
  success<NoteAddedToThread>({
    thread: { ...thread, tasks, revision },
    threadNote: aThreadNote(),
  });

describe("converting Notes beside other Task commands", () => {
  it("lets a Task the conversion added be completed after an earlier Task command settled", async () => {
    const old = { _id: "old" as TaskId, text: "Old task" };
    const seeded = aThread({ revision: 4, tasks: [old] });
    const converted = noteTaskId(note);
    const firstComplete = deferred<OperationResult<Thread>>();
    const conversion = deferred<OperationResult<NoteAddedToThread>>();
    const completeTask = vi
      .fn()
      .mockImplementationOnce(() => firstComplete.promise)
      .mockImplementation(async (input: { expectedRevision: number }) =>
        success<Thread>({
          ...seeded,
          tasks: [],
          revision: input.expectedRevision + 1,
        }),
      );
    const { wrapper } = setup(
      createFakeApplicationClient({
        completeTask,
        addNoteToThread: () => conversion.promise,
        getThreadActivityPage: async () => success({ entries: [] }),
      }),
      seeded,
    );
    const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
    const { result: tasks } = renderHook(() => useTasks(seeded), { wrapper });

    await act(async () => {
      void tasks.current.complete(old._id);
    });
    act(() => {
      add.current.mutate({ note, thread: seeded });
    });
    await act(async () => {
      void tasks.current.complete(converted);
    });
    await act(async () =>
      firstComplete.resolve(
        success<Thread>({ ...seeded, tasks: [], revision: 5 }),
      ),
    );
    await act(async () =>
      conversion.resolve(
        added([{ _id: converted, text: "Call the dentist", date }], 6),
      ),
    );

    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(2));
    expect(completeTask).toHaveBeenLastCalledWith({
      threadId: seeded._id,
      taskId: converted,
      expectedRevision: 6,
    });
  });

  it("brings back no Task whose conversion was undone when another replays", async () => {
    const undoFirst = deferred<boolean>();
    const undoSecond = deferred<boolean>();
    const { wrapper, open } = setup(
      createFakeApplicationClient({
        addNoteToThread: () => new Promise(() => undefined),
      }),
    );
    const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });

    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undoFirst.promise });
      add.current.mutate({
        note: second,
        thread,
        undoWindow: () => undoSecond.promise,
      });
    });
    await waitFor(() =>
      expect(open()?.tasks?.map((task) => task._id)).toEqual([
        noteTaskId(note),
        noteTaskId(second),
      ]),
    );

    await act(async () => undoFirst.resolve(false));

    await waitFor(() =>
      expect(open()?.tasks?.map((task) => task._id)).toEqual([
        noteTaskId(second),
      ]),
    );
  });

  it("keeps the newest revision when the conversion issued first lands last", async () => {
    const undoFirst = deferred<boolean>();
    const firstConversion = deferred<OperationResult<NoteAddedToThread>>();
    const secondConversion = deferred<OperationResult<NoteAddedToThread>>();
    const completeTask = vi.fn(async (input: { expectedRevision: number }) =>
      success<Thread>({ ...thread, revision: input.expectedRevision + 1 }),
    );
    const { wrapper, open } = setup(
      createFakeApplicationClient({
        completeTask,
        addNoteToThread: vi.fn((input: { noteId: NoteId }) =>
          input.noteId === note._id
            ? firstConversion.promise
            : secondConversion.promise,
        ),
        getThreadActivityPage: async () => success({ entries: [] }),
      }),
    );
    const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
    const { result: tasks } = renderHook(() => useTasks(thread), { wrapper });
    const { result: pending } = renderHook(() => usePendingTaskIds(), {
      wrapper,
    });
    // The second reaches the service first: the first waits out its Undo window.
    const both = [
      { _id: noteTaskId(second), text: "Pay the bill", date },
      { _id: noteTaskId(note), text: "Call the dentist", date },
    ];

    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undoFirst.promise });
      add.current.mutate({ note: second, thread });
    });
    await act(async () => secondConversion.resolve(added(both.slice(0, 1), 5)));
    await act(async () => undoFirst.resolve(true));
    await act(async () => firstConversion.resolve(added(both, 6)));
    await waitFor(() => expect(pending.current.size).toBe(0));
    expect(open()?.revision).toBe(6);
    expect(open()?.tasks).toEqual(both);

    await act(async () => {
      await tasks.current.complete(noteTaskId(note));
    });
    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 6 }),
    );
  });

  it("starts a Thread from a Note dated outside the range with an undated Task, before any optimistic write can throw", async () => {
    const outOfRange: Note = { ...note, followUp: -1 };
    const createThreadFromNote = vi.fn(
      () => new Promise<never>(() => undefined),
    );
    const { cache, wrapper } = setup(
      createFakeApplicationClient({ createThreadFromNote }),
    );
    const { result } = renderHook(() => useCreateThreadFromNote(), { wrapper });

    act(() => {
      result.current.mutate({ note: outOfRange, title: "Dentist" });
    });

    await waitFor(() => expect(createThreadFromNote).toHaveBeenCalledTimes(1));
    const threads = cache.getQueryData<Thread[]>(queryKeys.threads.open());
    const started = threads?.find((candidate) => candidate.title === "Dentist");
    expect(started?.tasks).toEqual([
      { _id: noteTaskId(outOfRange), text: "Call the dentist" },
    ]);
    expect(result.current.isError).toBe(false);
  });
});
