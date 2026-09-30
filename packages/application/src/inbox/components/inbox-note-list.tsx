import type { Note } from "@vita-os/contracts";

import { groupNotesByAttention } from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

import { AttentionCollapsed } from "../../attention-list";
import { useAttentionClock } from "../../hooks/use-attention-clock";
import { NoteCard } from "../../notes/note-card/note-card";
import { StandaloneNoteDialog } from "../../notes/note-view/standalone-note-dialog";

interface InboxNoteListProps {
  notes: Note[];
  /** Done Notes loaded so far from `notes.listDone`. */
  doneNotes?: Note[];
  /** Defaults to `true`: non-paginating callers render Completed only when non-empty. */
  isDoneExhausted?: boolean;
  isDoneInitialLoading?: boolean;
  canLoadMoreDone?: boolean;
  isLoadingMoreDone?: boolean;
  onLoadMoreDone?: () => void;
}

export function InboxNoteList({
  notes,
  doneNotes = [],
  isDoneExhausted = true,
  isDoneInitialLoading = false,
  canLoadMoreDone = false,
  isLoadingMoreDone = false,
  onLoadMoreDone,
}: InboxNoteListProps) {
  const now = useAttentionClock();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const groups = groupNotesByAttention(notes, now);
  const openCount =
    groups.pastDue.length +
    groups.today.length +
    groups.noDate.length +
    groups.comingUp.length;
  const openNotes = [
    ...groups.pastDue,
    ...groups.today,
    ...groups.noDate,
    ...groups.comingUp,
  ];
  const showCompleted =
    doneNotes.length > 0 || (!isDoneInitialLoading && !isDoneExhausted);

  return (
    <div>
      <div className="flex flex-col gap-4">
        {openCount === 0 ? (
          <InboxZero />
        ) : (
          <div className="flex flex-col gap-2.5">
            {openNotes.map((note) => (
              <NoteCard
                key={note._id}
                note={note}
                now={now}
                onOpenNote={setSelectedNote}
              />
            ))}
          </div>
        )}

        {showCompleted && (
          <AttentionCollapsed title="Completed" count={doneNotes.length}>
            <div className="flex flex-col gap-2.5 pt-1">
              {doneNotes.map((note) => (
                <NoteCard
                  key={note._id}
                  note={note}
                  now={now}
                  onOpenNote={setSelectedNote}
                />
              ))}
            </div>
            {(canLoadMoreDone || isLoadingMoreDone) && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={isLoadingMoreDone}
                  aria-busy={isLoadingMoreDone || undefined}
                  onClick={onLoadMoreDone}
                >
                  {isLoadingMoreDone ? (
                    <>
                      <Loader2
                        data-icon="inline-start"
                        className="size-3.5 animate-spin"
                      />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </AttentionCollapsed>
        )}
      </div>
      {selectedNote && (
        <StandaloneNoteDialog
          key={selectedNote._id}
          note={selectedNote}
          onOpenChange={(open) => {
            if (!open) setSelectedNote(null);
          }}
        />
      )}
    </div>
  );
}

function InboxZero() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/60 px-6 text-center">
      <CheckCircle2 className="mb-3 size-7 text-muted-foreground" />
      <h2 className="text-sm font-semibold">No active Notes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Capture a thought, information, or an action whenever you need.
      </p>
    </div>
  );
}
