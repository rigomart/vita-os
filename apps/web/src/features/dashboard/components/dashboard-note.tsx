import type { ProjectedNote } from "@convex/lib/validators";

import { Link } from "@tanstack/react-router";
import { format, isThisYear } from "date-fns";
import { Bell, Check } from "lucide-react";

import { WhenPopover } from "@/features/attention-list";
import { useCompleteNote } from "@/features/notes/use-complete-note";
import { useUpdateNoteWhen } from "@/features/notes/use-update-note-when";
import { cn } from "@/lib/utils";

import { dayDelta } from "./dashboard-model";

/**
 * A standalone Note on the board, in the same grammar as `NoteCard` and
 * `ThreadNoteCard`: a heavy edge doing the containing, the body first with
 * nothing in front of it, and the controls floating on the surface. A Note is
 * a thing you wrote, not a line item with a state in front — so on a board of
 * Thread cards it stays visibly a different kind of object, which is what lets
 * the two share a column without confusion.
 *
 * One radius and one padding step down from the full card, because here it
 * lives in a column rather than on the Notes page.
 */
export function DashboardNote({
  currentDate,
  note,
}: {
  currentDate: number;
  note: ProjectedNote;
}) {
  const completeNote = useCompleteNote();
  const updateNoteWhen = useUpdateNoteWhen();

  const when = note.when ?? undefined;
  const late = when !== undefined && dayDelta(when, currentDate) < 0;
  const due = when !== undefined && dayDelta(when, currentDate) === 0;

  return (
    <article
      className={cn(
        "group/note relative flex flex-col rounded-2xl border-2 border-border/70 bg-surface-2 px-3 py-2.5 transition-colors hover:border-border",
        late && "border-condition-attention/45",
      )}
    >
      <Link
        to="."
        search={(previous) => ({ ...previous, inbox: true as const })}
        className="text-[13px] leading-relaxed outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {note.body}
      </Link>

      <div className="mt-1.5 flex items-center gap-1">
        {/* The date is the button that changes it. Showing the date and then
            offering a separate control for it said the same thing twice. */}
        {when !== undefined && (
          <WhenPopover
            when={when}
            onSetWhen={(next) => void updateNoteWhen(note._id, next)}
            trigger={
              <button
                type="button"
                aria-label="Change attention date"
                className={cn(
                  "relative z-10 -mx-1 -my-0.5 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-2xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
                  late
                    ? "text-condition-attention"
                    : due
                      ? "text-foreground/80"
                      : "text-muted-foreground/70",
                )}
              >
                <Bell className="size-3" />
                {shortDate(when)}
              </button>
            }
          />
        )}

        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100">
          {when === undefined && (
            <WhenPopover
              when={when}
              onSetWhen={(next) => void updateNoteWhen(note._id, next)}
              trigger={
                <button
                  type="button"
                  aria-label="Set attention date"
                  title="Set attention date"
                  className="relative z-10 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Bell className="size-3.5" />
                </button>
              }
            />
          )}
          <button
            type="button"
            aria-label="Mark note done"
            title="Mark note done"
            onClick={() => void completeNote(note._id)}
            className="relative z-10 inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Check className="size-3.5" />
          </button>
        </span>
      </div>
    </article>
  );
}

function shortDate(timestamp: number) {
  const date = new Date(timestamp);
  return format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy");
}
