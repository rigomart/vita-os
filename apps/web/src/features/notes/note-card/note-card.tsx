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
 * A Note as a card: the body owns the whole top of it, and everything the card
 * can do sits in a footer beneath. Nothing frames or precedes the text, because
 * a Note is a thing you wrote — not a line item with a state in front of it.
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
        "group/card flex flex-col rounded-xl bg-surface-2 p-3 shadow-sm transition-shadow hover:shadow-md",
        done && "opacity-70 shadow-none hover:shadow-none",
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
        className="min-h-0 py-0"
        displayClassName={cn(
          "block border-transparent text-left text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere",
          // Not struck through: a completed Note is still there to be read.
          done && "text-muted-foreground/60",
        )}
      />

      <div className="mt-2 flex items-center gap-1 border-t border-border/30 pt-2">
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
                "-ml-1.5 h-7 gap-1.5 px-1.5 text-2xs font-normal",
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
