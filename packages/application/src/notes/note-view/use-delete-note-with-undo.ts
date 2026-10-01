import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useCallback } from "react";

import { CommandUndone } from "../../cache/undo-window";

/**
 * Delete a Note at once and offer Undo. The command waits out the offer, so an
 * undone delete never reaches the service; a failed one brings the Note back.
 */
export function useDeleteNoteWithUndo() {
  const feedback = useFeedback();

  return useCallback(
    async (
      remove: (undoWindow: () => Promise<boolean>) => Promise<unknown> | void,
    ) => {
      try {
        await remove(() => feedback.undoable("Note deleted"));
      } catch (error) {
        if (error instanceof CommandUndone) return;
        feedback.error("The note was not deleted. Please try again.");
      }
    },
    [feedback],
  );
}
