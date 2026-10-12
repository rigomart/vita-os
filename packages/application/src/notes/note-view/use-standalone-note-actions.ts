import type { Note, Repeat } from "@vita-os/contracts";

import { useApplicationClient } from "../../application-client-provider";
import { useArchiveNote } from "../use-archive-note";
import { useCompleteNote } from "../use-complete-note";
import { useRemoveNote } from "../use-remove-note";
import { useSetNoteRepeat } from "../use-set-note-repeat";
import { useUnarchiveNote } from "../use-unarchive-note";
import { useUpdateNoteBody } from "../use-update-note-body";
import { useUpdateNoteWhen } from "../use-update-note-when";

/**
 * What the Note view does to a Standalone Note.
 *
 * The view owns pending guards and feedback, so these keep their promises
 * intact: a failed command preserves the draft and is reported once.
 */
export function useStandaloneNoteActions(note: Note) {
  const archiveNote = useArchiveNote();
  const unarchiveNote = useUnarchiveNote();
  const removeNote = useRemoveNote();
  const updateNoteBody = useUpdateNoteBody();
  const updateNoteWhen = useUpdateNoteWhen();
  const setNoteRepeat = useSetNoteRepeat();
  const completeNote = useCompleteNote();
  const client = useApplicationClient();

  return {
    saveBody: (body: string) => updateNoteBody(note._id, body),
    /** Archive an Open Note, or return an Archived one to the board. */
    toggleArchived: () =>
      note.state === "done" ? unarchiveNote(note) : archiveNote(note._id),
    deleteNote: (undoWindow?: () => Promise<boolean>) =>
      removeNote(note._id, undoWindow),
    setWhen: (when: number | undefined) => updateNoteWhen(note._id, when),
    setRepeat: (repeat: Repeat | null) => setNoteRepeat(note._id, repeat),
    /**
     * Move a repeating Note to its next date. `undefined` when a completion
     * of it is already in flight.
     */
    complete: () => completeNote(note),
    /**
     * The Note as the service now holds it, read from the Open Notes, or
     * `undefined` when it is no longer open or cannot be read.
     */
    reread: async (): Promise<Note | undefined> => {
      const open = await client.listOpenNotes();
      return open.ok
        ? open.value.find((current) => current._id === note._id)
        : undefined;
    },
  };
}
