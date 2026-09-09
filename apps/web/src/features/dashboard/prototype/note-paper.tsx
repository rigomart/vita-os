/**
 * PROTOTYPE — issue #314, round 8. A standalone Note on the board, drawn in
 * the app's own Note grammar rather than as a Thread card.
 *
 * `NoteCard` and `ThreadNoteCard` already agree on what a Note looks like:
 * `rounded-3xl border-2 bg-surface-2`, the body first with nothing in front of
 * it, and the controls floating on the surface instead of framing it — the
 * NoteCard comment puts it as "a Note is a thing you wrote, not a line item
 * with a state in front". The board was breaking that rule, drawing Notes as
 * Thread cards with a dashed glyph.
 *
 * This is that grammar scaled for a column: one radius and one padding step
 * down, the heavy edge kept because the edge is what makes it read as paper.
 * No Area glyph (a standalone Note has no Area), no move, no title.
 */
import { format } from "date-fns";
import { Bell, CalendarClock, Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { PushMenu } from "./card-actions";
import { EntryLink } from "./prototype-shared";

export function NotePaper({
  currentDate,
  entry,
  onDone,
  onPush,
}: {
  currentDate: number;
  entry: PrototypeEntry;
  onDone: (entry: PrototypeEntry) => void;
  onPush: (entry: PrototypeEntry, when: number | undefined) => void;
}) {
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;
  const due =
    entry.when !== undefined && dayDelta(entry.when, currentDate) === 0;

  return (
    <article
      className={cn(
        "group/note relative flex flex-col rounded-2xl border-2 border-border/70 bg-surface-2 px-3 py-2.5 transition-colors hover:border-border",
        late && "border-condition-attention/45",
      )}
    >
      <EntryLink
        entry={entry}
        className="text-[13px] leading-relaxed after:absolute after:inset-0 after:content-['']"
      >
        {entry.note?.body ?? entry.title}
      </EntryLink>

      <div className="mt-1.5 flex items-center gap-1">
        {entry.when !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-2xs",
              late
                ? "text-condition-attention"
                : due
                  ? "text-foreground/80"
                  : "text-muted-foreground/70",
            )}
          >
            <Bell className="size-3" />
            {format(new Date(entry.when), "MMM d")}
          </span>
        )}

        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100 group-focus-within/note:opacity-100">
          <PushMenu
            currentDate={currentDate}
            entry={entry}
            onPush={onPush}
            trigger={
              <button
                type="button"
                aria-label="Change attention date"
                title="Change attention date"
                className="relative z-10 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <CalendarClock className="size-3.5" />
              </button>
            }
          />
          <button
            type="button"
            aria-label="Mark note done"
            title="Mark note done"
            onClick={() => onDone(entry)}
            className="relative z-10 inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <Check className="size-3.5" />
          </button>
        </span>
      </div>
    </article>
  );
}
