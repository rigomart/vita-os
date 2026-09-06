/**
 * PROTOTYPE — throwaway. No tests, no error handling beyond what the real hooks
 * already do.
 *
 * Round 1 asked what shape the Inbox should be. Cards won.
 * Round 2 varied arrangement and density — which turned out to be the wrong
 * knob: every card had the same insides.
 *
 * Round 3 varies the card's anatomy, on the question that actually decides it:
 * where does completion live on a note, and what does a done note look like?
 * These are wired to the real note actions — complete, reopen, edit, attention
 * date, delete all work — because an affordance can't be judged as a drawing.
 */
import type { ProjectedNote } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { groupNotesByAttention } from "@convex/lib/attentionOrdering";
import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isThisYear } from "date-fns";
import { Bell, Check, Circle, Undo2 } from "lucide-react";

import { EditableField } from "@/components/ui/editable-field";
import { AttentionCollapsed, RowDeleteAction } from "@/features/attention-list";
import { useNoteRowActions } from "@/features/notes/note-row/use-note-row-actions";
import { useAttentionClock } from "@/hooks/use-attention-clock";

interface VariantProps {
  notes: ProjectedNote[];
  doneNotes: ProjectedNote[];
}

type NoteActions = ReturnType<typeof useNoteRowActions>;

function shortDate(timestamp: number) {
  const date = new Date(timestamp);
  return format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy");
}

/** Attention ordering is the real list's, so the prototype sorts like the app. */
function useOrderedNotes(notes: ProjectedNote[]) {
  const now = useAttentionClock();
  const groups = groupNotesByAttention(notes, now);
  return [
    ...groups.pastDue,
    ...groups.today,
    ...groups.noDate,
    ...groups.comingUp,
  ];
}

/** The panel's own surface is the brightest token; paper needs a desk behind it. */
function Desk({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-3 -my-2 min-h-full bg-surface-1 px-3 py-3">
      {children}
    </div>
  );
}

/** Open cards, then the same cards under Completed — nothing the real list has is dropped. */
function CardSurface({
  notes,
  doneNotes,
  renderCard,
}: VariantProps & { renderCard: (note: ProjectedNote) => ReactNode }) {
  const ordered = useOrderedNotes(notes);

  return (
    <Desk>
      <div className="flex flex-col gap-2.5">{ordered.map(renderCard)}</div>
      {doneNotes.length > 0 && (
        <AttentionCollapsed title="Completed" count={doneNotes.length}>
          <div className="flex flex-col gap-2.5 pt-1">
            {doneNotes.map(renderCard)}
          </div>
        </AttentionCollapsed>
      )}
    </Desk>
  );
}

function NoteBody({
  note,
  actions,
  className,
}: {
  note: ProjectedNote;
  actions: NoteActions;
  className?: string;
}) {
  return (
    <EditableField
      value={note.body}
      variant="textarea"
      onSave={(text) => {
        if (text && !actions.isSavingText) actions.handleUpdateText(text);
      }}
      disabled={actions.isSavingText}
      inputAriaLabel="Edit note body"
      className="min-h-0 py-0"
      displayClassName={cn(
        "block border-transparent text-left text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere",
        note.state === "done" && "text-muted-foreground/60",
        className,
      )}
    />
  );
}

function DeleteAction({ actions }: { actions: NoteActions }) {
  return (
    <RowDeleteAction
      label="Delete note"
      title="Delete note?"
      description="This note will be permanently removed from your Notes. This action cannot be undone."
      confirmLabel="Delete"
      busy={actions.isDeletePending}
      onConfirm={actions.handleRemove}
    />
  );
}

/**
 * D1 — Header strip. The card wears a label: a meta bar across the top holding
 * the date and the note's controls, body underneath. A filed document, where
 * completion is one of the card's standing properties rather than a mark on the
 * text. Done cards say so in the strip instead of striking the body through.
 */
export function VariantD1({ notes, doneNotes }: VariantProps) {
  return (
    <CardSurface
      notes={notes}
      doneNotes={doneNotes}
      renderCard={(note) => <CardD1 key={note._id} note={note} />}
    />
  );
}

function CardD1({ note }: { note: ProjectedNote }) {
  const actions = useNoteRowActions(note);
  const done = note.state === "done";

  return (
    <article
      className={cn(
        "group/card flex flex-col rounded-xl bg-surface-2 shadow-sm",
        done && "opacity-70 shadow-none",
      )}
    >
      <div className="flex items-center gap-1 border-b border-border/40 px-3 py-1.5 text-2xs text-muted-foreground/80">
        {done ? (
          <span className="inline-flex items-center gap-1">
            <Check className="size-3" />
            Completed{" "}
            {note.completedAt === undefined
              ? null
              : shortDate(note.completedAt)}
          </span>
        ) : (
          <time dateTime={new Date(note.createdAt).toISOString()}>
            {shortDate(note.createdAt)}
          </time>
        )}
        {note.when !== undefined && !done && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>·</span>
            <Bell className="size-3" />
            {shortDate(note.when)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={actions.isTogglePending}
            aria-busy={actions.isTogglePending}
            aria-label={done ? "Mark note open" : "Mark note done"}
            onClick={actions.handleToggleComplete}
          >
            {done ? <Undo2 /> : <Check />}
          </Button>
          <DeleteAction actions={actions} />
        </span>
      </div>
      <div className="px-3 py-2.5">
        <NoteBody note={note} actions={actions} />
        {!done && (
          <div className="mt-1.5 -ml-2">
            <DatePicker
              value={note.when === undefined ? undefined : new Date(note.when)}
              onChange={(date) => actions.handleUpdateWhen(date?.getTime())}
              disabled={actions.isWhenPending}
              placeholder="Attention date"
            />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * D2 — Gutter. A column inside the card carries a ring you fill in, aligned to
 * the first line of the note. The control is always visible and always in the
 * same place, so completing is one aimed click — the checkbox's real advantage,
 * kept inside the card rather than out in the row.
 */
export function VariantD2({ notes, doneNotes }: VariantProps) {
  return (
    <CardSurface
      notes={notes}
      doneNotes={doneNotes}
      renderCard={(note) => <CardD2 key={note._id} note={note} />}
    />
  );
}

function CardD2({ note }: { note: ProjectedNote }) {
  const actions = useNoteRowActions(note);
  const done = note.state === "done";

  return (
    <article
      className={cn(
        "group/card flex gap-2.5 rounded-xl bg-surface-2 p-3 shadow-sm",
        done && "opacity-70 shadow-none",
      )}
    >
      <button
        type="button"
        disabled={actions.isTogglePending}
        aria-busy={actions.isTogglePending}
        aria-label={done ? "Mark note open" : "Mark note done"}
        onClick={actions.handleToggleComplete}
        className="mt-0.5 shrink-0 text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        {done ? (
          <Check className="size-4 text-brand-accent-foreground" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <NoteBody note={note} actions={actions} />
        <div className="mt-1.5 flex items-center gap-2 text-2xs text-muted-foreground/70">
          <time dateTime={new Date(note.createdAt).toISOString()}>
            {shortDate(note.createdAt)}
          </time>
          {note.when !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Bell className="size-3" />
              {shortDate(note.when)}
            </span>
          )}
          <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <DeleteAction actions={actions} />
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * D3 — Action footer. The body owns the top of the card with no chrome at all;
 * a footer carries the attention date on the left and a labelled Complete pill
 * on the right. Completion reads as something you log about a note, not a box
 * on it — and the pill has room to say "Completed" once it has happened.
 */
export function VariantD3({ notes, doneNotes }: VariantProps) {
  return (
    <CardSurface
      notes={notes}
      doneNotes={doneNotes}
      renderCard={(note) => <CardD3 key={note._id} note={note} />}
    />
  );
}

function CardD3({ note }: { note: ProjectedNote }) {
  const actions = useNoteRowActions(note);
  const done = note.state === "done";

  return (
    <article
      className={cn(
        "group/card flex flex-col rounded-xl bg-surface-2 p-3 shadow-sm",
        done && "opacity-70 shadow-none",
      )}
    >
      <NoteBody note={note} actions={actions} />
      <div className="mt-2 flex items-center gap-1 border-t border-border/30 pt-2">
        <div className="-ml-2 min-w-0 flex-1">
          <DatePicker
            value={note.when === undefined ? undefined : new Date(note.when)}
            onChange={(date) => actions.handleUpdateWhen(date?.getTime())}
            disabled={actions.isWhenPending || done}
            placeholder="Attention date"
          />
        </div>
        <span className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <DeleteAction actions={actions} />
        </span>
        <Button
          variant={done ? "ghost" : "secondary"}
          size="sm"
          className="h-7 shrink-0 rounded-full px-2.5 text-xs"
          disabled={actions.isTogglePending}
          aria-busy={actions.isTogglePending}
          onClick={actions.handleToggleComplete}
        >
          {done ? (
            <>
              <Undo2 data-icon="inline-start" className="size-3" />
              Completed
            </>
          ) : (
            <>
              <Check data-icon="inline-start" className="size-3" />
              Complete
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
