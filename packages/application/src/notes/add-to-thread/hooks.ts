import type {
  AreaId,
  Note,
  NoteAddedToThread,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { decideAddNoteToThread, newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../../cache/use-application-mutation";

import { insertNewestFirst, patchQuery } from "../../cache/patch";
import { afterUndoWindow } from "../../cache/undo-window";
import { useApplicationMutation } from "../../cache/use-application-mutation";
import { queryKeys } from "../../query-keys";
import {
  settleNoteAddedToThread,
  settlePendingThread,
  showNoteAddedToThread,
  showPendingThread,
  threadChangeKeys,
} from "../../threads/optimistic";
import { noteKeys, showNoteLeavingOpenNotes } from "../optimistic";

/** The Thread Note a Note becomes, shown before the service mints its own. */
function pendingThreadNote(note: Note, id: ThreadNoteId): ThreadNote {
  return {
    _id: id,
    body: note.body,
    state: "open",
    createdAt: note.createdAt,
    updatedAt: note.updatedAt ?? note.createdAt,
  };
}

function patchOpenThreadNotes(
  cache: Parameters<typeof patchQuery>[0],
  threadId: ThreadId,
  patch: (notes: ThreadNote[]) => ThreadNote[],
) {
  patchQuery<ThreadNote[]>(cache, queryKeys.threadNotes.open(threadId), patch);
}

export interface AddNoteToThreadVariables {
  note: Note;
  /** The Thread as the person chose it; the earlier date is decided from it. */
  thread: Thread;
  undoWindow?: () => Promise<boolean>;
}

/**
 * Add an Open Standalone Note to an Open Thread. The Note leaves Notes and the
 * Dashboard at once; the Thread shows the date it may take and the activity
 * stamp, and the Thread Note appears where its creation time puts it. With an
 * `undoWindow` the command waits out the Undo offer, so an undone add never
 * reaches the service.
 */
export function useAddNoteToThread(): ApplicationMutationResult<
  AddNoteToThreadVariables,
  NoteAddedToThread,
  ThreadNoteId
> {
  return useApplicationMutation<
    AddNoteToThreadVariables,
    NoteAddedToThread,
    ThreadNoteId
  >({
    run: async (client, { note, thread, undoWindow }) => {
      await afterUndoWindow(undoWindow);
      return client.addNoteToThread({ noteId: note._id, threadId: thread._id });
    },
    affected: ({ thread }, cache) => [
      ...noteKeys(),
      ...threadChangeKeys(cache, { threadId: thread._id }),
      queryKeys.threadNotes.open(thread._id),
    ],
    optimistic: (cache, { note, thread }, previousLocal) => {
      const pendingId = previousLocal ?? (newRecordId() as ThreadNoteId);
      const decision = decideAddNoteToThread(thread, note);
      showNoteLeavingOpenNotes(cache, note._id);
      showNoteAddedToThread(cache, thread._id, {
        followUp: decision.patch.followUp,
        lastActivityAt: Date.now(),
        lastActivityContent: decision.logs.at(-1)?.content,
      });
      patchOpenThreadNotes(cache, thread._id, (notes) =>
        insertNewestFirst(
          notes,
          pendingThreadNote(note, pendingId),
          (candidate) => candidate.createdAt,
        ),
      );
      return pendingId;
    },
    reconcile: (cache, added, { thread }, pendingId) => {
      settleNoteAddedToThread(cache, added.thread);
      patchOpenThreadNotes(cache, thread._id, (notes) =>
        notes.map((existing) =>
          existing._id === pendingId ? added.threadNote : existing,
        ),
      );
    },
    // A changed date writes an Activity Log entry, which is read separately.
    alsoInvalidate: ({ thread }) => [queryKeys.threads.activity(thread._id)],
  });
}

export interface CreateThreadFromNoteVariables {
  note: Note;
  title: string;
  areaId?: AreaId;
}

/**
 * Start a Thread from a Note: the Thread appears with the Note's date, the Note
 * leaves Notes, and the new Thread's Notes are seeded with the Thread Note so
 * its pane opens with the Note inside.
 */
export function useCreateThreadFromNote(): ApplicationMutationResult<
  CreateThreadFromNoteVariables,
  NoteAddedToThread,
  ThreadId
> {
  return useApplicationMutation<
    CreateThreadFromNoteVariables,
    NoteAddedToThread,
    ThreadId
  >({
    run: (client, { note, title, areaId }) =>
      client.createThreadFromNote({
        noteId: note._id,
        title,
        ...(areaId === undefined ? {} : { areaId }),
      }),
    affected: (_input, cache) => [
      ...noteKeys(),
      ...threadChangeKeys(cache, {}),
    ],
    optimistic: (cache, { note, title, areaId }, previousLocal) => {
      const pendingId = previousLocal ?? (newRecordId() as ThreadId);
      const now = Date.now();
      showNoteLeavingOpenNotes(cache, note._id);
      showPendingThread(
        cache,
        { title, ...(areaId === undefined ? {} : { areaId }) },
        { id: pendingId, now },
      );
      const decision = decideAddNoteToThread(
        { title, slug: "", state: "open" },
        note,
      );
      showNoteAddedToThread(cache, pendingId, {
        followUp: decision.patch.followUp,
        lastActivityAt: now,
        lastActivityContent: decision.logs.at(-1)?.content,
      });
      return pendingId;
    },
    reconcile: (cache, added, _input, pendingId) => {
      if (pendingId !== undefined)
        settlePendingThread(cache, pendingId, added.thread);
      cache.setQueryData<ThreadNote[]>(
        queryKeys.threadNotes.open(added.thread._id),
        (notes) =>
          notes?.some((existing) => existing._id === added.threadNote._id)
            ? notes
            : [added.threadNote, ...(notes ?? [])],
      );
    },
  });
}
