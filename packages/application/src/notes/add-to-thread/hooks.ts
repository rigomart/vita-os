import type {
  AreaId,
  Note,
  NoteAddedToThread,
  TaskId,
  Thread,
  ThreadNote,
} from "@vita-os/contracts";

import type { ApplicationMutationResult } from "../../cache/use-application-mutation";

import {
  changeRecords,
  insertNewestFirst,
  insertOrdered,
  patchQuery,
} from "../../cache/patch";
import { afterUndoWindow } from "../../cache/undo-window";
import { useApplicationMutation } from "../../cache/use-application-mutation";
import { queryKeys } from "../../query-keys";
import { settleTaskChange, threadChangeKeys } from "../../threads/optimistic";
import { noteKeys, showNoteLeavingOpenNotes } from "../optimistic";

/** A converted source names its destination Task once. */
function taskIdFor(note: Note): TaskId {
  return `note-task-${note._id}` as TaskId;
}
function showConfirmedNote(
  cache: Parameters<typeof patchQuery>[0],
  added: NoteAddedToThread,
) {
  const key = queryKeys.threadNotes.open(added.thread._id);
  cache.setQueryData<ThreadNote[]>(key, (notes) =>
    notes?.some((note) => note._id === added.threadNote._id)
      ? notes
      : insertNewestFirst(
          notes ?? [],
          added.threadNote,
          (note) => note.createdAt,
        ),
  );
}
function hideSource(cache: Parameters<typeof patchQuery>[0], note: Note) {
  return changeRecords<Note>(cache, noteKeys(), [note._id], [], () =>
    showNoteLeavingOpenNotes(cache, note._id),
  );
}
export interface AddNoteToThreadVariables {
  note: Note;
  thread: Thread;
  undoWindow?: () => Promise<boolean>;
}
/** Hide the source immediately; publish the destination only once saved after Undo. */
export function useAddNoteToThread(): ApplicationMutationResult<
  AddNoteToThreadVariables,
  NoteAddedToThread
> {
  return useApplicationMutation<AddNoteToThreadVariables, NoteAddedToThread>({
    mutationKey: ["note-conversion"],
    run: async (client, { note, thread, undoWindow }) => {
      await afterUndoWindow(undoWindow);
      return client.addNoteToThread({
        noteId: note._id,
        threadId: thread._id,
        taskId: taskIdFor(note),
      });
    },
    affected: ({ thread }, cache) => [
      ...noteKeys(),
      ...threadChangeKeys(cache, { threadId: thread._id }),
      queryKeys.threadNotes.open(thread._id),
    ],
    optimistic: (cache, { note }) => hideSource(cache, note),
    reconcile: (cache, added) => {
      settleTaskChange(cache, added.thread);
      showConfirmedNote(cache, added);
    },
    alsoInvalidate: ({ thread }) => [queryKeys.threads.activity(thread._id)],
  });
}
export interface CreateThreadFromNoteVariables {
  note: Note;
  title: string;
  areaId?: AreaId;
}
/** Creating from a Note also publishes only the confirmed Thread and its Note. */
export function useCreateThreadFromNote(): ApplicationMutationResult<
  CreateThreadFromNoteVariables,
  NoteAddedToThread
> {
  return useApplicationMutation<
    CreateThreadFromNoteVariables,
    NoteAddedToThread
  >({
    mutationKey: ["note-conversion"],
    run: (client, { note, title, areaId }) =>
      client.createThreadFromNote({
        noteId: note._id,
        taskId: taskIdFor(note),
        title,
        ...(areaId === undefined ? {} : { areaId }),
      }),
    affected: (_input, cache) => [
      ...noteKeys(),
      ...threadChangeKeys(cache, {}),
    ],
    optimistic: (cache, { note }) => hideSource(cache, note),
    reconcile: (cache, added) => {
      patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
        threads.some((thread) => thread._id === added.thread._id)
          ? threads
          : insertOrdered(threads, added.thread, (thread) => thread.order),
      );
      showConfirmedNote(cache, added);
    },
  });
}
