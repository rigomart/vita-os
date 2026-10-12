import type { Note } from "@vita-os/contracts";

import { useState } from "react";

import { useOpenThreadInPlace } from "../../navigation/use-open-thread-in-place";
import { AddToThreadDialog } from "../add-to-thread/add-to-thread-dialog";
import { NewThreadFromNoteDialog } from "../add-to-thread/new-thread-from-note-dialog";
import { useAddNoteToThreadWithUndo } from "../add-to-thread/use-add-note-to-thread-with-undo";
import { isStaleCompletion } from "../use-complete-note";
import { NoteDialog } from "./note-dialog";
import { useDeleteNoteWithUndo } from "./use-delete-note-with-undo";
import { useStandaloneNoteActions } from "./use-standalone-note-actions";

/** Mount above moving cards, keyed by id, for the lifetime of an open view. */
export function StandaloneNoteDialog({
  note,
  onOpenChange,
}: {
  note: Note;
  onOpenChange: (open: boolean) => void;
}) {
  const [savedNote, setSavedNote] = useState(note);
  // Adding the Note to a Thread steps aside from the Note view; cancelling
  // returns to it unchanged.
  const [adding, setAdding] = useState<"existing" | "new" | null>(null);
  const actions = useStandaloneNoteActions(savedNote);
  const deleteWithUndo = useDeleteNoteWithUndo();
  const openThread = useOpenThreadInPlace();
  const addWithUndo = useAddNoteToThreadWithUndo(openThread);

  return (
    <>
      <NoteDialog
        open={adding === null}
        onOpenChange={onOpenChange}
        note={savedNote}
        followUp={savedNote.followUp}
        onSave={async (body) => {
          const updated = await actions.saveBody(body);
          setSavedNote(updated);
        }}
        onToggleArchived={async () => {
          const updated = await actions.toggleArchived();
          setSavedNote(updated);
        }}
        onDelete={() => void deleteWithUndo(actions.deleteNote)}
        onAddToThread={() => setAdding("existing")}
        onNewThread={() => setAdding("new")}
        onSetWhen={async (when) => {
          const updated = await actions.setWhen(when);
          setSavedNote(updated);
        }}
        repeat={savedNote.repeat}
        onSetRepeat={async (repeat) => {
          const updated = await actions.setRepeat(repeat);
          setSavedNote(updated);
        }}
        onComplete={async () => {
          try {
            const updated = await actions.complete();
            if (updated !== undefined) setSavedNote(updated);
          } catch (error) {
            // The view holds its own copy: a Note completed or changed
            // elsewhere shows as it now is before the refusal is reported.
            if (isStaleCompletion(error)) {
              const current = await actions.reread().catch(() => undefined);
              if (current !== undefined) setSavedNote(current);
            }
            throw error;
          }
        }}
      />
      {adding === "existing" && (
        <AddToThreadDialog
          note={savedNote}
          onOpenChange={(open) => {
            if (!open) setAdding(null);
          }}
          onChoose={(thread) => {
            void addWithUndo(savedNote, thread);
            onOpenChange(false);
          }}
        />
      )}
      {adding === "new" && (
        <NewThreadFromNoteDialog
          note={savedNote}
          onOpenChange={(open) => {
            if (!open) setAdding(null);
          }}
          onCreated={(slug) => {
            onOpenChange(false);
            openThread(slug);
          }}
        />
      )}
    </>
  );
}
