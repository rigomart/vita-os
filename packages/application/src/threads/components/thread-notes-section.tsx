import type { ThreadId } from "@vita-os/contracts";

import { useDeleteNoteWithUndo } from "../../notes/note-view/use-delete-note-with-undo";
import {
  useCaptureThreadNote,
  useCompleteThreadNote,
  useDiscardThreadNote,
  useDoneThreadNotes,
  useReopenThreadNote,
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
  const doneNotes = useDoneThreadNotes(threadId, PAGE_SIZE);
  const capture = useCaptureThreadNote();
  const updateBody = useUpdateThreadNoteBody();
  const complete = useCompleteThreadNote();
  const reopen = useReopenThreadNote();
  const discard = useDiscardThreadNote();
  const deleteWithUndo = useDeleteNoteWithUndo();

  return (
    <ThreadNotes
      threadTitle={threadTitle}
      // A Thread that is gone reads as no Notes, the way it always did.
      notes={openNotes.data ?? undefined}
      doneNotes={doneNotes.notes}
      isDoneExhausted={!doneNotes.hasNextPage && !doneNotes.isPending}
      isDoneInitialLoading={doneNotes.isPending}
      canLoadMoreDone={doneNotes.hasNextPage && !doneNotes.isFetchingNextPage}
      isLoadingMoreDone={doneNotes.isFetchingNextPage}
      onLoadMoreDone={() => void doneNotes.fetchNextPage()}
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
      onToggleDone={async (note) => {
        if (note.state === "done") await reopen.mutateAsync({ threadId, note });
        else await complete.mutateAsync({ threadId, threadNoteId: note._id });
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
