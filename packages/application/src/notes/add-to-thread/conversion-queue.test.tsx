import type {
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
  ThreadNote,
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
import { useAddNoteToThread } from "./hooks";

const existing = { _id: "existing" as TaskId, text: "Book room" };
const thread = aThread({ tasks: [existing] });
const note: Note = {
  _id: "source" as NoteId,
  body: "Call clinic",
  followUp: new Date(2026, 9, 8).getTime(),
  state: "open",
  createdAt: 1000,
};
const destination = {
  ...thread,
  focusedTaskId: `note-task-${note._id}` as TaskId,
  tasks: [
    existing,
    {
      _id: `note-task-${note._id}` as TaskId,
      text: note.body,
      date: note.followUp,
    },
  ],
};
function setup() {
  const undo = deferred<boolean>();
  const saved = deferred<OperationResult<NoteAddedToThread>>();
  const addNoteToThread = vi.fn(() => saved.promise);
  const addTask = vi.fn(async (input: { taskId: TaskId; text: string }) =>
    success({
      ...thread,
      tasks: [existing, { _id: input.taskId, text: input.text }],
    }),
  );
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.notes.open(), [note]);
  queryClient.setQueryData(queryKeys.threads.open(), [thread]);
  queryClient.setQueryData(queryKeys.threadNotes.open(thread._id), []);
  const applicationClient = createQuietApplicationClient({
    addNoteToThread,
    addTask,
  });
  const options = { applicationClient, queryClient };
  const { result: add } = renderHook(() => useAddNoteToThread(), options);
  const { result: tasks } = renderHook(() => useTasks(thread), options);
  act(() =>
    add.current.mutate({ note, thread, undoWindow: () => undo.promise }),
  );
  return { add, tasks, queryClient, undo, saved, addNoteToThread, addTask };
}
describe("conversion Undo without a Thread lock", () => {
  it("hides only the source through Undo and the request, then publishes one confirmed destination", async () => {
    const { queryClient, undo, saved, addNoteToThread, add } = setup();
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([]),
    );
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([
      thread,
    ]);
    expect(
      queryClient.getQueryData(queryKeys.threadNotes.open(thread._id)),
    ).toEqual([]);
    expect(addNoteToThread).not.toHaveBeenCalled();
    await act(async () => undo.resolve(true));
    await waitFor(() => expect(addNoteToThread).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([
      thread,
    ]);
    const threadNote = aThreadNote();
    await act(async () =>
      saved.resolve(success({ thread: destination, threadNote })),
    );
    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.threads.open())).toEqual([
      destination,
    ]);
    expect(
      queryClient.getQueryData<ThreadNote[]>(
        queryKeys.threadNotes.open(thread._id),
      ),
    ).toEqual([threadNote]);
  });
  it("Undo restores the source without issuing conversion, preserving an unrelated accepted Task", async () => {
    const { queryClient, undo, addNoteToThread, addTask, tasks, add } = setup();
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([]),
    );
    await act(async () => {
      await tasks.current.add("Bring paperwork");
    });
    expect(addTask).toHaveBeenCalledTimes(1);
    await act(async () => undo.resolve(false));
    await waitFor(() => expect(add.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([note]);
    expect(
      queryClient
        .getQueryData<Thread[]>(queryKeys.threads.open())?.[0]
        ?.tasks?.map((task) => task.text),
    ).toEqual([existing.text, "Bring paperwork"]);
    expect(addNoteToThread).not.toHaveBeenCalled();
  });
});
