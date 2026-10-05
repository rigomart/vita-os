import type { ThreadNote } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { Markdown, markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isThisYear } from "date-fns";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { useState } from "react";

import { AttentionCollapsed } from "../../attention-list";
import { NoteDialog } from "../../notes/note-view/note-dialog";

interface ThreadNotesProps {
  notes: ThreadNote[] | undefined;
  threadTitle?: string;
  archivedNotes?: ThreadNote[];
  isArchivedExhausted?: boolean;
  isArchivedInitialLoading?: boolean;
  canLoadMoreArchived?: boolean;
  isLoadingMoreArchived?: boolean;
  onLoadMoreArchived?: () => void;
  onCreate: (body: string) => Promise<void> | void;
  onUpdateBody: (note: ThreadNote, body: string) => Promise<void> | void;
  /** Archive an Open Note, or unarchive an Archived one. */
  onToggleArchived: (note: ThreadNote) => Promise<void> | void;
  /** Deletes at once; the owner offers Undo. */
  onRemove: (note: ThreadNote) => void;
}

export function ThreadNotes({
  notes,
  threadTitle = "Thread",
  archivedNotes = [],
  isArchivedExhausted = true,
  isArchivedInitialLoading = false,
  canLoadMoreArchived = false,
  isLoadingMoreArchived = false,
  onLoadMoreArchived,
  onCreate,
  onUpdateBody,
  onToggleArchived,
  onRemove,
}: ThreadNotesProps) {
  const [composing, setComposing] = useState(false);
  // Kept above both lists: archiving a Note can task or remove its card.
  const [selected, setSelected] = useState<ThreadNote | null>(null);
  const showArchived =
    archivedNotes.length > 0 ||
    (!isArchivedInitialLoading && !isArchivedExhausted);
  const currentNote = selected;
  const card = (note: ThreadNote) => (
    <ThreadNoteCard
      key={note._id}
      note={note}
      onOpen={() => setSelected(note)}
      onToggleArchived={onToggleArchived}
    />
  );

  return (
    <section aria-label="Thread Notes" className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="min-h-10 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        Write a note…
      </button>
      {notes && notes.length > 0 ? (
        <div className="flex flex-col gap-2.5">{notes.map(card)}</div>
      ) : null}
      {showArchived && (
        <AttentionCollapsed title="Archived notes" count={archivedNotes.length}>
          <div className="flex flex-col gap-2.5 pt-1">
            {archivedNotes.map(card)}
          </div>
          {(canLoadMoreArchived || isLoadingMoreArchived) && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLoadingMoreArchived}
                aria-busy={isLoadingMoreArchived || undefined}
                onClick={onLoadMoreArchived}
              >
                {isLoadingMoreArchived ? (
                  <>
                    <Loader2 className="animate-spin" />
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
      {composing && (
        <NoteDialog
          open
          threadTitle={threadTitle}
          onOpenChange={setComposing}
          onSubmit={async ({ body }) => {
            await onCreate(body);
          }}
        />
      )}
      {currentNote && (
        <NoteDialog
          key={currentNote._id}
          open
          note={currentNote}
          threadTitle={threadTitle}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          onSave={async (body) => {
            await onUpdateBody(currentNote, body);
            setSelected({ ...currentNote, body, updatedAt: Date.now() });
          }}
          onToggleArchived={async () => {
            await onToggleArchived(currentNote);
            const archiving = currentNote.state !== "done";
            setSelected({
              ...currentNote,
              state: archiving ? "done" : "open",
              completedAt: archiving ? Date.now() : undefined,
            });
          }}
          onDelete={() => onRemove(currentNote)}
        />
      )}
    </section>
  );
}

function ThreadNoteCard({
  note,
  onOpen,
  onToggleArchived,
}: {
  note: ThreadNote;
  onOpen: () => void;
  onToggleArchived: (note: ThreadNote) => Promise<void> | void;
}) {
  const archived = note.state === "done";
  const { run: toggle, isPending } = useGuardedAsyncAction(
    () => onToggleArchived(note),
    {
      successMessage: archived ? "Note unarchived" : "Note archived",
    },
  );
  const timestamp = archived
    ? (note.completedAt ?? note.createdAt)
    : note.createdAt;
  const date = new Date(timestamp);
  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-3xl border-2 border-border/70 bg-surface-2 p-4",
        "animate-in fade-in slide-in-from-bottom-2 transition-colors duration-300 hover:border-border has-focus-visible:border-ring/50 motion-reduce:animate-none",
        archived && "border-border/40 bg-transparent opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open note: ${markdownToPlainText(note.body).slice(0, 120)}`}
        className="text-left outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/30"
      >
        <div className="relative max-h-36 overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:top-32 after:h-4 after:bg-linear-to-b after:from-transparent after:to-surface-2">
          <Markdown
            variant="preview"
            className={cn("text-sm", archived && "text-muted-foreground/60")}
          >
            {note.body}
          </Markdown>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-end gap-2">
        <time
          dateTime={date.toISOString()}
          className="text-2xs text-muted-foreground/60"
        >
          {format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy")}
        </time>
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(
            "group/toggle relative shrink-0 rounded-full",
            archived && "bg-transparent text-brand-accent-text",
          )}
          disabled={isPending}
          aria-busy={isPending}
          aria-label={archived ? "Unarchive note" : "Archive note"}
          onClick={(event) => {
            event.stopPropagation();
            void toggle();
          }}
        >
          {archived ? (
            <>
              <Archive className="group-hover/toggle:hidden" />
              <ArchiveRestore className="hidden group-hover/toggle:block" />
            </>
          ) : (
            <Archive />
          )}
        </Button>
      </div>
    </article>
  );
}
