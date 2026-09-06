import type { ProjectedNote } from "@convex/lib/validators";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useCallback } from "react";

import { useCompleteNote } from "@/features/notes/use-complete-note";
import { useRemoveNote } from "@/features/notes/use-remove-note";
import { useUncompleteNote } from "@/features/notes/use-uncomplete-note";
import { useUpdateNoteBody } from "@/features/notes/use-update-note-body";
import { useUpdateNoteWhen } from "@/features/notes/use-update-note-when";

export function useNoteRowActions(note: ProjectedNote) {
  const feedback = useFeedback();
  const completeNote = useCompleteNote();
  const uncompleteNote = useUncompleteNote();
  const removeNote = useRemoveNote();
  const updateNoteBody = useUpdateNoteBody();
  const updateNoteWhen = useUpdateNoteWhen();

  const { run: toggleComplete, isPending: isTogglePending } =
    useGuardedAsyncAction(
      async (intent: "complete" | "reopen") => {
        if (intent === "reopen") {
          await uncompleteNote(note);
        } else {
          await completeNote(note._id);
        }
      },
      { errorToast: true },
    );

  const handleToggleComplete = useCallback(() => {
    const intent = note.state === "done" ? "reopen" : "complete";
    void toggleComplete(intent).then((result) => {
      if (result.ok) {
        feedback.success(
          intent === "complete" ? "Note completed" : "Note reopened",
        );
      }
    });
  }, [feedback, note.state, toggleComplete]);

  const { run: deleteNote, isPending: isDeletePending } = useGuardedAsyncAction(
    async () => {
      await removeNote(note._id);
    },
    { successMessage: "Note deleted", errorToast: true },
  );

  const { run: saveNoteBody, isPending: isSavingText } = useGuardedAsyncAction(
    async (body: string) => {
      await updateNoteBody(note._id, body);
    },
    { errorToast: true },
  );

  const { run: saveNoteWhen, isPending: isWhenPending } = useGuardedAsyncAction(
    async (when: number | undefined) => {
      await updateNoteWhen(note._id, when);
    },
    { errorToast: true },
  );

  return {
    handleToggleComplete,
    isTogglePending,
    handleRemove: () => {
      void deleteNote();
    },
    isDeletePending,
    handleUpdateText: (body: string) => {
      void saveNoteBody(body);
    },
    isSavingText,
    handleUpdateWhen: (when: number | undefined) => {
      void saveNoteWhen(when);
    },
    isWhenPending,
  };
}
