import type { ThreadNote } from "@vita-os/contracts";

import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { format, isSameYear } from "date-fns";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import { clock } from "../../lib/clock";
import { NoteMarker } from "../../notes/note-marker";
import { NoteDialog } from "../../notes/note-view/note-dialog";

interface ThreadNotesProps {
  notes: ThreadNote[] | undefined;
  threadTitle?: string;
  onCreate: (body: string) => Promise<void> | void;
  onUpdateBody: (note: ThreadNote, body: string) => Promise<void> | void;
  /** Deletes at once; the owner offers Undo. */
  onRemove: (note: ThreadNote) => void;
}

/**
 * A Thread's Notes as lines like its Tasks', newest first. A line opens the
 * Note view; "Write a note…" sits on top.
 */
export function ThreadNotes({
  notes,
  threadTitle = "Thread",
  onCreate,
  onUpdateBody,
  onRemove,
}: ThreadNotesProps) {
  const section = useRef<HTMLElement>(null);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<ThreadNote | null>(null);
  const focusAfterDelete = useRef<HTMLElement | null>(null);
  const currentNote = selected;
  const open = (note: ThreadNote) => {
    focusAfterDelete.current = null;
    setSelected(note);
  };
  const focusTargetAfterRemoving = (note: ThreadNote) => {
    const lines = Array.from(
      section.current?.querySelectorAll<HTMLElement>("[data-note-id]") ?? [],
    );
    const position = lines.findIndex(
      (line) => line.dataset.noteId === note._id,
    );
    const neighbor = lines[position + 1] ?? lines[position - 1];
    return (
      neighbor?.querySelector<HTMLButtonElement>("button") ??
      section.current?.querySelector<HTMLButtonElement>("button") ??
      null
    );
  };

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
      {notes && notes.length > 0 ? (
        <ul aria-label="Notes" className="flex flex-col gap-0.5">
          {notes.map((note) => (
            <ThreadNoteRow
              key={note._id}
              note={note}
              onOpen={() => open(note)}
            />
          ))}
        </ul>
      ) : null}
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
          finalFocus={() => focusAfterDelete.current}
          onDelete={() => {
            focusAfterDelete.current = focusTargetAfterRemoving(currentNote);
            onRemove(currentNote);
          }}
        />
      )}
    </section>
  );
}

function ThreadNoteRow({
  note,
  onOpen,
}: {
  note: ThreadNote;
  onOpen: () => void;
}) {
  const text = markdownToPlainText(note.body).trim();
  const date = new Date(note.createdAt);
  return (
    <li
      data-note-id={note._id}
      className="relative flex items-start gap-1.5 rounded-lg px-1 pt-1 pb-1.5 text-foreground/90 transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/60 motion-reduce:transition-none"
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
        <time
          dateTime={date.toISOString()}
          className="block text-xs text-muted-foreground/70 tabular-nums"
        >
          {format(
            date,
            isSameYear(date, clock.now()) ? "MMM d" : "MMM d, yyyy",
          )}
        </time>
      </div>
    </li>
  );
}

function withoutBlankLines(text: string) {
  return text.replace(/\n{2,}/g, "\n");
}
