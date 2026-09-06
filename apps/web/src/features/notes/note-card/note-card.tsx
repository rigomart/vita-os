import type { ProjectedNote } from "@convex/lib/validators";

import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isThisYear } from "date-fns";
import { Bell, Check, Undo2 } from "lucide-react";

import { EditableField } from "@/components/ui/editable-field";
import {
  RowDeleteAction,
  whenTone,
  WhenPopover,
} from "@/features/attention-list";
import { useNoteRowActions } from "@/features/notes/note-row/use-note-row-actions";

const whenToneClassName = {
  due: "text-brand-accent-foreground",
  overdue: "text-condition-attention",
} as const;

function shortDate(timestamp: number) {
  const date = new Date(timestamp);
  return format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy");
}

/**
 * A Note as a card, in the same grammar as the new Note dialog: one open
 * writing surface, a heavy edge doing all the containing, and controls floating
 * on the surface rather than framing it. The card is a step down from the
 * dialog — a 2px edge to its 4px, one radius smaller — so a Note reads as the
 * same kind of object as the one you wrote it in. Nothing precedes the text,
 * because a Note is a thing you wrote, not a line item with a state in front.
 */
export function NoteCard({ note, now }: { note: ProjectedNote; now: number }) {
  const {
    handleRemove,
    handleToggleComplete,
    handleUpdateText,
    handleUpdateWhen,
    isDeletePending,
    isSavingText,
    isTogglePending,
    isWhenPending,
  } = useNoteRowActions(note);
  const done = note.state === "done";
  const tone = done ? undefined : whenTone(note.when, now);
  const stamp =
    done && note.completedAt !== undefined ? note.completedAt : note.createdAt;

  return (
    <article
      className={cn(
        "group/card flex flex-col rounded-3xl border-2 border-border/70 bg-surface-2 p-4",
        "transition-colors hover:border-border has-focus-visible:border-ring/50",
        done && "border-border/40 bg-transparent opacity-70",
      )}
    >
      <EditableField
        value={note.body}
        variant="textarea"
        onSave={(text) => {
          if (!text || isSavingText) return;
          handleUpdateText(text);
        }}
        disabled={isSavingText}
        inputAriaLabel="Edit note body"
        editOnFocus
        textareaRows={1}
        chromeless
        className={cn(
          "min-h-0 py-0 text-left text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere caret-ring",
          // Not struck through: a completed Note is still there to be read.
          done && "text-muted-foreground/60",
        )}
      />

      {/* No divider: the dialog separates by whitespace, and so does the card. */}
      <div className="mt-3 flex items-center gap-1">
        <WhenPopover
          when={note.when}
          busy={isWhenPending}
          onSetWhen={handleUpdateWhen}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              disabled={isWhenPending}
              aria-busy={isWhenPending}
              aria-label={
                note.when === undefined
                  ? "Set attention date"
                  : "Change attention date"
              }
              className={cn(
                "-ml-1 h-7 gap-1.5 rounded-full px-2 text-2xs font-normal",
                note.when === undefined
                  ? "text-muted-foreground/60 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 aria-expanded:opacity-100"
                  : "text-muted-foreground",
                tone && whenToneClassName[tone],
              )}
            >
              <Bell className="size-3" />
              {note.when === undefined
                ? "Attention date"
                : shortDate(note.when)}
            </Button>
          }
        />

        <time
          dateTime={new Date(stamp).toISOString()}
          className="ml-auto pr-1 text-2xs text-muted-foreground/60"
        >
          {shortDate(stamp)}
        </time>

        <span className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <RowDeleteAction
            label="Delete note"
            title="Delete note?"
            description="This note will be permanently removed from your Notes. This action cannot be undone."
            confirmLabel="Delete"
            busy={isDeletePending}
            onConfirm={handleRemove}
          />
        </span>

        {/* Done is a state, so the icon stays a check — until you reach for it,
            when it becomes the undo it would perform. */}
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(
            "group/toggle shrink-0 rounded-full",
            done && "bg-transparent text-brand-accent-foreground",
          )}
          disabled={isTogglePending}
          aria-busy={isTogglePending}
          aria-label={done ? "Mark note open" : "Mark note done"}
          onClick={handleToggleComplete}
        >
          {done ? (
            <>
              <Check className="group-hover/toggle:hidden" />
              <Undo2 className="hidden group-hover/toggle:block" />
            </>
          ) : (
            <Check />
          )}
        </Button>
      </div>
    </article>
  );
}
