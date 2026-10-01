import type { Note } from "@vita-os/contracts";

import { markdownToPlainText } from "@vita-os/ui/components/markdown";

import { useCompleteNote } from "../../notes/use-complete-note";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import {
  BoardCard,
  BoardCompleteButton,
  BoardDate,
  isLate,
  showsBoardDate,
} from "./board-card";

/**
 * A standalone Note on the board, in the same `BoardCard` as a Thread. The
 * frame the Note wears on the Notes page belongs to writing surfaces; here it
 * sits among Threads being triaged, so it takes their shape and tells itself
 * apart by what it says instead: the body in regular weight where a Thread
 * has a bold title, and a margin rule rather than a tag, since on this board a
 * pill always means an Area.
 *
 * The whole card opens the full Note view, except its footer controls.
 */
export function DashboardNote({
  currentDate,
  dateInHeading = false,
  note,
  onTray,
  onOpenNote,
}: {
  currentDate: number;
  /** The group heading above already names this Note's day. */
  dateInHeading?: boolean;
  note: Note;
  onTray?: boolean;
  onOpenNote: (note: Note) => void;
}) {
  const completeNote = useCompleteNote();
  const updateNoteWhen = useUpdateNoteWhen();

  const when = note.attentionDate ?? undefined;
  const showsDate = showsBoardDate(when, dateInHeading);
  const attentionDate = (
    <BoardDate
      currentDate={currentDate}
      inHeading={dateInHeading}
      labels={{ change: "Change attention date", set: "Set attention date" }}
      onSetWhen={(next) => void updateNoteWhen(note._id, next)}
      when={when}
    />
  );

  return (
    <BoardCard
      late={isLate(when, currentDate)}
      onTray={onTray}
      ruled
      footer={
        <>
          {showsDate && attentionDate}

          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {!showsDate && attentionDate}
            <BoardCompleteButton
              label="Mark note done"
              onClick={() => void completeNote(note._id)}
            />
          </span>
        </>
      }
    >
      <button
        type="button"
        aria-label={`Open note: ${markdownToPlainText(note.body).slice(0, 120)}`}
        onClick={() => onOpenNote(note)}
        // The overlay stretches the button over the whole card; the footer's
        // controls sit above it, so only they keep their own clicks.
        className="line-clamp-2 min-h-0 rounded-sm py-0 text-left text-sm leading-snug whitespace-pre-line wrap-anywhere text-foreground/85 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        {markdownToPlainText(note.body)}
      </button>
    </BoardCard>
  );
}
