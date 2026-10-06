import type { Note, Thread } from "@vita-os/contracts";

import { useFeedback } from "@vita-os/ui/lib/feedback";

import { CommandUndone } from "../../cache/undo-window";
import { ThreadBusy } from "../../threads/task-queue";
import { useAddNoteToThread } from "./hooks";

/**
 * Add a Note to a Thread at once and offer Undo, as deleting does (ADR 0025).
 * The command waits out the offer, so an undone add never reaches the
 * service; a failed one brings the Note back. Open thread commits at once and
 * opens the Thread's pane.
 */
export function useAddNoteToThreadWithUndo(openThread: (slug: string) => void) {
  const feedback = useFeedback();
  const add = useAddNoteToThread();

  return async (note: Note, thread: Thread) => {
    try {
      await add.mutateAsync({
        note,
        thread,
        undoWindow: () =>
          feedback.undoable("Note added to thread", {
            action: {
              label: "Open thread",
              onClick: () => openThread(thread.slug),
            },
          }),
      });
    } catch (error) {
      if (error instanceof CommandUndone) return;
      if (error instanceof ThreadBusy) {
        feedback.error(error.message);
        return;
      }
      feedback.error("The note was not added to the thread. Please try again.");
    }
  };
}
