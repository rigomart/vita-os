import type { ThreadId } from "@vita-os/contracts";

import { useDeleteNoteWithUndo } from "../../notes/note-view/use-delete-note-with-undo";
import {
  useCaptureThreadNote,
  useDiscardThreadNote,
  useThreadNotes,
  useUpdateThreadNoteBody,
} from "../../thread-notes/hooks";
import { ThreadNotes } from "./thread-notes";

export function ThreadNotesSection({
  threadId,
  threadTitle,
}: {
  threadId: ThreadId;
  threadTitle: string;
}) {
  const notes = useThreadNotes(threadId);
  const capture = useCaptureThreadNote();
  const updateBody = useUpdateThreadNoteBody();
  const discard = useDiscardThreadNote();
  const deleteWithUndo = useDeleteNoteWithUndo();

  return (
    <ThreadNotes
      threadTitle={threadTitle}
      // A Thread that is gone reads as no Notes, the way it always did.
      notes={notes.data ?? undefined}
      onCreate={async (body) => {
        await capture.mutateAsync({ threadId, body });
      }}
      onUpdateBody={async (note, body) => {
        await updateBody.mutateAsync({
          threadId,
          threadNoteId: note._id,
          body,
        });
      }}
      onRemove={(note) =>
        void deleteWithUndo((undoWindow) =>
          discard.mutateAsync({
            threadId,
            threadNoteId: note._id,
            undoWindow,
          }),
        )
      }
    />
  );
}
