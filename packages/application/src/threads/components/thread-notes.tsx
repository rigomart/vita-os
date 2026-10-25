import type { ThreadNote } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { TooltipProvider } from "@vita-os/ui/components/tooltip";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isSameYear } from "date-fns";
import { Check, Loader2, Plus, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

import { AttentionCollapsed } from "../../attention-list";
import { clock } from "../../lib/clock";
import { NoteMarker } from "../../notes/note-marker";
import { NoteDialog } from "../../notes/note-view/note-dialog";
import { useFocusRecovery } from "../../ui/recover-focus";
import {
  Command,
  CommandButton,
  completeCommandClassName,
  revealed,
} from "./row-commands";

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
  /** Complete an Open Note, or reopen a Completed one. */
  onToggleArchived: (note: ThreadNote) => Promise<void> | void;
  /** Deletes at once; the owner offers Undo. */
  onRemove: (note: ThreadNote) => void;
}

/**
 * A Thread's Notes as lines like its Tasks'. A line opens the Note view;
 * "Write a note…" sits on top.
 */
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
  const recoverFocus = useFocusRecovery();
  const section = useRef<HTMLElement>(null);
  const [composing, setComposing] = useState(false);
  // Kept above both lists: archiving a Note can task or remove its card.
  const [selected, setSelected] = useState<ThreadNote | null>(null);
  const showArchived =
    archivedNotes.length > 0 ||
    (!isArchivedInitialLoading && !isArchivedExhausted);
  const currentNote = selected;
  const noteAction = (note: ThreadNote, run: () => Promise<void> | void) => {
    const cards = Array.from(
      section.current?.querySelectorAll<HTMLElement>("[data-note-id]") ?? [],
    );
    const card = cards.find((card) => card.dataset.noteId === note._id);
    const siblings = cards.filter(
      (candidate) => candidate.parentElement === card?.parentElement,
    );
    const position = card ? siblings.indexOf(card) : -1;
    const neighbor = siblings[position + 1] ?? siblings[position - 1];
    const target =
      neighbor?.querySelector<HTMLButtonElement>("button") ??
      section.current?.querySelector<HTMLButtonElement>("button");
    return recoverFocus(() => target, run);
  };
  const card = (note: ThreadNote) => (
    <ThreadNoteRow
      key={note._id}
      note={note}
      onOpen={() => setSelected(note)}
      onToggleArchived={(note) =>
        noteAction(note, () => onToggleArchived(note))
      }
    />
  );

  return (
    <section
      ref={section}
      aria-label="Thread Notes"
      className="flex flex-col gap-0.5"
    >
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="group/write flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-left text-sm text-muted-foreground/60 outline-none transition-colors hover:bg-muted/50 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none xl:min-h-8"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50 xl:size-6"
        >
          <Plus className="size-3" />
        </span>
        Write a note…
      </button>
      <TooltipProvider delay={300}>
        {notes && notes.length > 0 ? (
          <ul aria-label="Notes" className="flex flex-col gap-0.5">
            {notes.map(card)}
          </ul>
        ) : null}
        {showArchived && (
          <AttentionCollapsed
            title="Completed notes"
            count={archivedNotes.length}
          >
            <ul
              aria-label="Completed notes"
              className="flex flex-col gap-0.5 pt-1"
            >
              {archivedNotes.map(card)}
            </ul>
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
      </TooltipProvider>
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
            setSelected({ ...currentNote, body, updatedAt: clock.now() });
          }}
          onToggleArchived={async () => {
            await onToggleArchived(currentNote);
            const archiving = currentNote.state !== "done";
            setSelected({
              ...currentNote,
              state: archiving ? "done" : "open",
              completedAt: archiving ? clock.now() : undefined,
            });
          }}
          onDelete={() => {
            void noteAction(currentNote, () => onRemove(currentNote));
          }}
        />
      )}
    </section>
  );
}

function ThreadNoteRow({
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
      successMessage: archived ? "Note reopened" : "Note completed",
    },
  );
  const text = markdownToPlainText(note.body).trim();
  const timestamp = archived
    ? (note.completedAt ?? note.createdAt)
    : note.createdAt;
  const date = new Date(timestamp);
  return (
    <li
      data-note-id={note._id}
      className={cn(
        "group/row relative flex items-start gap-1.5 rounded-lg px-1 pt-1 pb-0.5 text-foreground/90 transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/60 motion-reduce:transition-none",
        archived && "text-muted-foreground",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center xl:size-6">
        <NoteMarker />
      </span>
      <div className="min-w-0 flex-1 pt-1 xl:pt-0">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open note: ${text.slice(0, 120)}`}
          className="block w-full py-0.5 text-left text-sm leading-snug outline-none after:absolute after:inset-0 after:rounded-lg"
        >
          <span className="line-clamp-3 whitespace-pre-line">
            {withoutBlankLines(text)}
          </span>
        </button>
        <div className="flex min-h-8 items-center gap-2 xl:min-h-7">
          <time
            dateTime={date.toISOString()}
            className="flex-1 text-xs text-muted-foreground/70 tabular-nums"
          >
            {format(
              date,
              isSameYear(date, clock.now()) ? "MMM d" : "MMM d, yyyy",
            )}
          </time>
          <div
            role="toolbar"
            aria-label="Note commands"
            className={cn("-mr-1 flex shrink-0 items-center", revealed)}
          >
            <Command label={archived ? "Reopen" : "Complete"}>
              <CommandButton
                aria-disabled={isPending || undefined}
                aria-busy={isPending}
                aria-label={archived ? "Reopen note" : "Complete note"}
                className={cn(
                  "relative z-10",
                  !archived && completeCommandClassName,
                )}
                onClick={() => {
                  if (!isPending) void toggle();
                }}
              >
                {archived ? <RotateCcw /> : <Check />}
              </CommandButton>
            </Command>
          </div>
        </div>
      </div>
    </li>
  );
}

function withoutBlankLines(text: string) {
  return text.replace(/\n{2,}/g, "\n");
}
