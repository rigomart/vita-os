import type { Note } from "@vita-os/contracts";

import { useArchiveNote } from "../use-archive-note";
import { useRemoveNote } from "../use-remove-note";
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

  return {
    saveBody: (body: string) => updateNoteBody(note._id, body),
    /** Archive an Open Note, or return an Archived one to the board. */
    toggleArchived: () =>
      note.state === "done" ? unarchiveNote(note) : archiveNote(note._id),
    deleteNote: (undoWindow?: () => Promise<boolean>) =>
      removeNote(note._id, undoWindow),
    setWhen: (when: number | undefined) => updateNoteWhen(note._id, when),
  };
}
