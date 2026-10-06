import type {
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
import { noteTaskId } from "../../threads/pending-conversions";
import { useTasks } from "../../threads/use-tasks";
import { useAddNoteToThread } from "./hooks";

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
  it("is named once, sent, and can be completed during the Undo window: the command lands after the conversion", async () => {
    const undo = deferred<boolean>();
    const conversion = deferred<OperationResult<NoteAddedToThread>>();
    const taskId = noteTaskId(note);
    const addNoteToThread = vi.fn(() => conversion.promise);
    const completeTask = vi.fn(
      async (input: { expectedRevision: number }) =>
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

    act(() => {
      add.current.mutate({ note, thread, undoWindow: () => undo.promise });
    });
    await act(async () => {
      void tasks.current.complete(taskId);
    });
    // Nothing reaches the service while the Undo window is open.
    expect(addNoteToThread).not.toHaveBeenCalled();
    expect(completeTask).not.toHaveBeenCalled();

    await act(async () => undo.resolve(true));
    await waitFor(() =>
      expect(addNoteToThread).toHaveBeenCalledExactlyOnceWith({
        noteId: note._id,
        threadId: thread._id,
        taskId,
      }),
    );
    expect(completeTask).not.toHaveBeenCalled();

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

    await waitFor(() =>
      expect(completeTask).toHaveBeenCalledExactlyOnceWith({
        threadId: thread._id,
        taskId,
        expectedRevision: 5,
      }),
    );
  });
});
