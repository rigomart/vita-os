import type {
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  success,
} from "../../test/fake-application-client";
import { aThread, aThreadNote } from "../../test/fixtures";
import {
  act,
  createTestQueryClient,
  renderHook,
  waitFor,
} from "../../test/render-with-providers";
import { useTasks } from "../../threads/use-tasks";
import { useAddNoteToThread, useCreateThreadFromNote } from "./hooks";
const date = new Date(2026, 9, 9, 15).getTime();
const note: Note = {
  _id: "dated" as NoteId,
  body: "Call dentist",
  followUp: date,
  state: "open",
  createdAt: 1000,
};
const thread = aThread();
describe("acting on a confirmed conversion", () => {
  it("completes the confirmed Task using its displayed occurrence and leaves one Thread Note", async () => {
    const converted = {
      ...thread,
      tasks: [
        { _id: `note-task-${note._id}` as TaskId, text: note.body, date },
      ],
    };
    const threadNote = aThreadNote({ body: note.body });
    const addNoteToThread = vi.fn(async () =>
      success({ thread: converted, threadNote }),
    );
    const completeTask = vi.fn(async () => success(thread));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.notes.open(), [note]);
    queryClient.setQueryData(queryKeys.threads.open(), [thread]);
    const options = {
      queryClient,
      applicationClient: createQuietApplicationClient({
        addNoteToThread,
        completeTask,
      }),
    };
    const { result: add } = renderHook(() => useAddNoteToThread(), options);
    const { result: tasks, rerender } = renderHook(
      ({ shown }) => useTasks(shown),
      { ...options, initialProps: { shown: thread } },
    );
    await act(async () => {
      await add.current.mutateAsync({ note, thread });
    });
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([
      converted,
    ]);
    rerender({ shown: converted });
    await act(async () => {
      await tasks.current.complete(converted.tasks[0]!._id);
    });
    expect(completeTask).toHaveBeenCalledExactlyOnceWith({
      threadId: thread._id,
      taskId: converted.tasks[0]!._id,
      expectedOccurrence: date,
      timeZone: expect.any(String),
    });
    expect(
      queryClient.getQueryData(queryKeys.threadNotes.open(thread._id)),
    ).toEqual([threadNote]);
  });
  it("hides the source when creating a Thread and waits for the confirmed destination", async () => {
    const saved = deferred<OperationResult<NoteAddedToThread>>();
    const createThreadFromNote = vi.fn(() => saved.promise);
    const queryClient = createTestQueryClient();
    const outOfRange = { ...note, followUp: -1 };
    queryClient.setQueryData(queryKeys.notes.open(), [outOfRange]);
    queryClient.setQueryData<Thread[]>(queryKeys.threads.open(), []);
    const { result } = renderHook(() => useCreateThreadFromNote(), {
      queryClient,
      applicationClient: createQuietApplicationClient({ createThreadFromNote }),
    });
    act(() => result.current.mutate({ note: outOfRange, title: "Dentist" }));
    await waitFor(() => expect(createThreadFromNote).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([]);
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([]);
    const confirmed = {
      ...thread,
      title: "Dentist",
      tasks: [{ _id: `note-task-${note._id}` as TaskId, text: note.body }],
    };
    await act(async () =>
      saved.resolve(
        success({
          thread: confirmed,
          threadNote: aThreadNote({ body: note.body }),
        }),
      ),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([
      confirmed,
    ]);
    expect(result.current.isError).toBe(false);
  });
});
