import type { Note } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { Markdown, markdownToPlainText } from "@vita-os/ui/components/markdown";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isThisYear } from "date-fns";
import { CalendarClock, Check, Undo2 } from "lucide-react";

import {
  followUpDateLabels,
  whenTone,
  WhenPopover,
  withTimeToken,
} from "../../attention-list";
import { useNoteRowActions } from "../note-row/use-note-row-actions";

const whenToneClassName = {
  due: "text-brand-accent-text",
  overdue: "text-condition-attention",
} as const;

function shortDate(timestamp: number) {
  const date = new Date(timestamp);
  return format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy");
}

/** A saved Note previews its body and opens the full Note view. */
export function NoteCard({
  note,
  now,
  onOpenNote,
}: {
  note: Note;
  now: number;
  onOpenNote: (note: Note) => void;
}) {
  const {
    handleToggleComplete,
    handleUpdateWhen,
    isTogglePending,
    isWhenPending,
  } = useNoteRowActions(note);
  const done = note.state === "done";
  const tone = done ? undefined : whenTone(note.followUp, now);
  const stamp =
    done && note.completedAt !== undefined ? note.completedAt : note.createdAt;

  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-3xl border-2 border-border/70 bg-surface-2 p-4",
        "animate-in fade-in slide-in-from-bottom-2 transition-colors duration-300 hover:border-border has-focus-visible:border-ring/50 motion-reduce:animate-none",
        done && "border-border/40 bg-transparent opacity-70",
      )}
    >
      <button
        type="button"
        aria-label={`Open note: ${markdownToPlainText(note.body).slice(0, 120)}`}
        onClick={() => onOpenNote(note)}
        className={cn(
          "min-w-0 rounded-lg text-left outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:ring-3 focus-visible:ring-ring/30",
          done && "text-muted-foreground/60",
        )}
      >
        <span className="relative block">
          <Markdown
            variant="preview"
            className="line-clamp-6 max-h-36 overflow-hidden text-sm leading-relaxed"
          >
            {note.body}
          </Markdown>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-surface-2 to-transparent"
          />
        </span>
      </button>

      {/* No divider: the dialog separates by whitespace, and so does the card.
          The row stays unpositioned so its gaps open the Note; only the
          controls rise above the card-wide button. */}
      <div className="mt-3 flex items-center gap-1">
        <WhenPopover
          when={note.followUp}
          busy={isWhenPending}
          onSetWhen={handleUpdateWhen}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              disabled={isWhenPending}
              aria-busy={isWhenPending}
              aria-label={
                note.followUp === undefined
                  ? followUpDateLabels.set
                  : followUpDateLabels.change
              }
              className={cn(
                "relative -ml-1 h-7 gap-1.5 rounded-full px-2 text-2xs font-normal",
                note.followUp === undefined
                  ? "text-muted-foreground/60 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 aria-expanded:opacity-100"
                  : "text-muted-foreground",
                tone && whenToneClassName[tone],
              )}
            >
              <CalendarClock className="size-3" />
              {note.followUp === undefined
                ? followUpDateLabels.name
                : withTimeToken(shortDate(note.followUp), note.followUp)}
            </Button>
          }
        />

        <time
          dateTime={new Date(stamp).toISOString()}
          className="ml-auto pr-1 text-2xs text-muted-foreground/60"
        >
          {shortDate(stamp)}
        </time>

        {/* Done is a state, so the icon stays a check — until you reach for it,
            when it becomes the undo it would perform. */}
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(
            "group/toggle relative shrink-0 rounded-full",
            done && "bg-transparent text-brand-accent-text",
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
