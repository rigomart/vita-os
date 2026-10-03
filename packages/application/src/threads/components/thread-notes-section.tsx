import type { ThreadId } from "@vita-os/contracts";

import { useDeleteNoteWithUndo } from "../../notes/note-view/use-delete-note-with-undo";
import {
  useCaptureThreadNote,
  useArchiveThreadNote,
  useDiscardThreadNote,
  useArchivedThreadNotes,
  useUnarchiveThreadNote,
  useThreadNotes,
  useUpdateThreadNoteBody,
} from "../../thread-notes/hooks";
import { ThreadNotes } from "./thread-notes";

const PAGE_SIZE = 20;

export function ThreadNotesSection({
  threadId,
  threadTitle,
}: {
  threadId: ThreadId;
  threadTitle: string;
}) {
  const openNotes = useThreadNotes(threadId);
  const archivedNotes = useArchivedThreadNotes(threadId, PAGE_SIZE);
  const capture = useCaptureThreadNote();
  const updateBody = useUpdateThreadNoteBody();
  const archive = useArchiveThreadNote();
  const unarchive = useUnarchiveThreadNote();
  const discard = useDiscardThreadNote();
  const deleteWithUndo = useDeleteNoteWithUndo();

  return (
    <ThreadNotes
      threadTitle={threadTitle}
      // A Thread that is gone reads as no Notes, the way it always did.
      notes={openNotes.data ?? undefined}
      archivedNotes={archivedNotes.notes}
      isArchivedExhausted={
        !archivedNotes.hasNextPage && !archivedNotes.isPending
      }
      isArchivedInitialLoading={archivedNotes.isPending}
      canLoadMoreArchived={
        archivedNotes.hasNextPage && !archivedNotes.isFetchingNextPage
      }
      isLoadingMoreArchived={archivedNotes.isFetchingNextPage}
      onLoadMoreArchived={() => void archivedNotes.fetchNextPage()}
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
      onToggleArchived={async (note) => {
        if (note.state === "done") {
          await unarchive.mutateAsync({ threadId, note });
        } else {
          await archive.mutateAsync({ threadId, threadNoteId: note._id });
        }
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
