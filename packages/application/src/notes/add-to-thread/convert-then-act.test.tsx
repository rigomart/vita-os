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
import { noteTaskId, useConversionLock } from "../../threads/task-queue";
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
    const { result: pending } = renderHook(() => useConversionLock(thread), {
      wrapper,
    });

    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undo.promise });
    });
    // Nothing reaches the service while the Undo window is open, and the
    // Task it shows is pending.
    await waitFor(() =>
      expect(pending.current.pendingTaskIds.has(taskId)).toBe(true),
    );
    expect(addNoteToThread).not.toHaveBeenCalled();

    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(addNoteToThread).toHaveBeenCalledExactlyOnceWith({
        noteId: note._id,
        threadId: thread._id,
        taskId,
      }),
    );
    expect(pending.current.pendingTaskIds.has(taskId)).toBe(true);

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
    await waitFor(() => expect(pending.current.pendingTaskIds.size).toBe(0));

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

describe("converting Notes beside other Task commands", () => {
  it("takes back only its own Task when undone, keeping one added before it", async () => {
    const undo = deferred<boolean>();
    const addTask = vi.fn(
      async (input: {
        taskId: TaskId;
        text: string;
        expectedRevision: number;
      }) =>
        success<Thread>({
          ...thread,
          tasks: [{ _id: input.taskId, text: input.text }],
          revision: input.expectedRevision + 1,
        }),
    );
    const { wrapper, open } = setup(
      createFakeApplicationClient({
        addTask,
        addNoteToThread: () => new Promise(() => undefined),
      }),
    );
    const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
    const { result: tasks } = renderHook(() => useTasks(thread), { wrapper });
    const texts = () => open()?.tasks?.map((task) => task.text);

    await act(async () => {
      await tasks.current.add("Book the room");
    });
    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undo.promise });
    });
    await waitFor(() =>
      expect(texts()).toEqual(["Book the room", "Call the dentist"]),
    );

    await act(async () => undo.resolve(false));

    await waitFor(() => expect(texts()).toEqual(["Book the room"]));
    expect(open()?.revision).toBe(5);
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
