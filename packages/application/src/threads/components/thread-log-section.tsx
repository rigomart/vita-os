import type { ThreadId, ThreadNote } from "@vita-os/contracts";

import { useRef, useState } from "react";

import { clock } from "../../lib/clock";
import { NoteDialog } from "../../notes/note-view/note-dialog";
import { useDeleteNoteWithUndo } from "../../notes/note-view/use-delete-note-with-undo";
import {
  useDiscardThreadNote,
  useThreadNotes,
  useUpdateThreadNoteBody,
} from "../../thread-notes/hooks";
import { useThreadActivity } from "../hooks";
import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadId: ThreadId;
  threadTitle: string;
  threadCreatedAt: number;
}

const PAGE_SIZE = 20;

/**
 * The Activity Log beside the Thread's Notes, which its Note entries read and
 * open. It waits for both, so a Note's line never shows without its words
 * while they load.
 */
export function ActivityLogSection({
  threadId,
  threadTitle,
  threadCreatedAt,
}: ActivityLogSectionProps) {
  const activity = useThreadActivity(threadId, PAGE_SIZE);
  const notes = useThreadNotes(threadId);
  const updateBody = useUpdateThreadNoteBody();
  const discard = useDiscardThreadNote();
  const deleteWithUndo = useDeleteNoteWithUndo();
  const [selected, setSelected] = useState<ThreadNote | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const deleted = useRef(false);
  if (activity.error !== null) throw new Error(activity.error.message);

  return (
    <div ref={log}>
      <ActivityLog
        logs={
          activity.isPending || notes.isPending ? undefined : activity.entries
        }
        startedAt={activity.hasNextPage ? undefined : threadCreatedAt}
        threadNotes={notes.data ?? undefined}
        onOpenNote={(note) => {
          deleted.current = false;
          setSelected(note);
        }}
        canLoadMore={activity.hasNextPage && !activity.isFetchingNextPage}
        isLoadingMore={activity.isFetchingNextPage}
        onLoadMore={() => void activity.fetchNextPage()}
      />
      {selected && (
        <NoteDialog
          key={selected._id}
          open
          note={selected}
          threadTitle={threadTitle}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          onSave={async (body) => {
            await updateBody.mutateAsync({
              threadId,
              threadNoteId: selected._id,
              body,
            });
            setSelected({ ...selected, body, updatedAt: clock.now() });
          }}
          // The line that opened a deleted Note stops opening it, so focus
          // goes to the panel holding the log; the dialog takes only a
          // tabbable element.
          finalFocus={() =>
            deleted.current
              ? (log.current?.closest<HTMLElement>('[role="tabpanel"]') ?? null)
              : null
          }
          onDelete={() => {
            deleted.current = true;
            void deleteWithUndo((undoWindow) =>
              discard.mutateAsync({
                threadId,
                threadNoteId: selected._id,
                undoWindow,
              }),
            );
          }}
        />
      )}
    </div>
  );
}
