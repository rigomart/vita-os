import type { Note } from "@vita-os/contracts";

import { useState } from "react";

import { useNoteRowActions } from "../note-row/use-note-row-actions";
import { NoteDialog } from "./note-dialog";

/** Mount above moving cards, keyed by id, for the lifetime of an open view. */
export function StandaloneNoteDialog({
  note,
  onOpenChange,
}: {
  note: Note;
  onOpenChange: (open: boolean) => void;
}) {
  const [savedNote, setSavedNote] = useState(note);
  const actions = useNoteRowActions(savedNote);

  return (
    <NoteDialog
      open
      onOpenChange={onOpenChange}
      note={savedNote}
      attentionDate={savedNote.attentionDate}
      onSave={async (body) => {
        const updated = await actions.saveBody(body);
        setSavedNote(updated);
      }}
      onToggleDone={async () => {
        const updated = await actions.toggleDone();
        setSavedNote(updated);
      }}
      onDelete={async () => {
        await actions.deleteNote();
        onOpenChange(false);
      }}
      onSetWhen={async (when) => {
        const updated = await actions.setWhen(when);
        setSavedNote(updated);
      }}
    />
  );
}
