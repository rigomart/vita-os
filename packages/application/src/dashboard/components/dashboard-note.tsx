import type { Note, Repeat } from "@vita-os/contracts";

import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { Archive } from "lucide-react";

import { useArchiveNote } from "../../notes/use-archive-note";
import {
  completeNoteFailure,
  completeNoteLabel,
  useCompleteNote,
} from "../../notes/use-complete-note";
import { useSetNoteRepeat } from "../../notes/use-set-note-repeat";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import {
  BoardCard,
  BoardCompleteButton,
  BoardDate,
  showsBoardDate,
} from "./board-card";

/**
 * A standalone Note on the board, in the same `BoardCard` as a Thread. The
 * frame the Note wears on the Notes page belongs to writing surfaces; here it
 * sits among Threads being triaged, so it takes their shape and tells itself
 * apart by what it says and by its sheet: the body in regular weight where a
 * Thread has a bold title, and a dog-eared corner rather than a tag, since on
 * this board a pill always means an Area.
 *
 * A repeating Note wears the repeat glyph on its date, under any heading, and
 * offers Complete where a one-off Note offers Archive: completing moves it to
 * its next date. Archive stays in its Note view, where it ends the rhythm.
 *
 * The whole card opens the full Note view, except its footer controls.
 */
export function DashboardNote({
  currentDate,
  dateInHeading = false,
  note,
  onOpenNote,
}: {
  currentDate: number;
  /** The group heading above already names this Note's day. */
  dateInHeading?: boolean;
  note: Note;
  onOpenNote: (note: Note) => void;
}) {
  const archiveNote = useArchiveNote();
  // The card leaves at once; the toast says where the Note went.
  const archive = useGuardedAsyncAction(() => archiveNote(note._id), {
    successMessage: "Note archived",
  });
  const completeNote = useCompleteNote();
  // The card moves to its next date, which its label named.
  const complete = useGuardedAsyncAction(() => completeNote(note), {
    getErrorMessage: completeNoteFailure,
  });
  const updateNoteWhen = useUpdateNoteWhen();
  const setNoteRepeat = useSetNoteRepeat();
  const dateAction = useGuardedAsyncAction((when: number | undefined) =>
    updateNoteWhen(note._id, when),
  );
  const repeatAction = useGuardedAsyncAction((repeat: Repeat | null) =>
    setNoteRepeat(note._id, repeat),
  );
  const busy =
    complete.isPending || dateAction.isPending || repeatAction.isPending;

  const when = note.followUp ?? undefined;
  const repeats = when !== undefined && note.repeat !== undefined;
  const showsDate = repeats || showsBoardDate(when, dateInHeading);
  const followUp = (
    <BoardDate
      busy={busy}
      currentDate={currentDate}
      inHeading={dateInHeading}
      onSetWhen={(next) => dateAction.run(next)}
      repeat={{
        value: note.repeat,
        onChange: (repeat) => repeatAction.run(repeat),
      }}
      showsRepeat
      when={when}
    />
  );

  return (
    <BoardCard
      dogEared
      footer={
        <>
          {showsDate && followUp}

          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {!showsDate && followUp}
            {repeats ? (
              <BoardCompleteButton
                label={completeNoteLabel(note, currentDate)}
                disabled={busy}
                onClick={() => void complete.run()}
              />
            ) : (
              <BoardCompleteButton
                icon={Archive}
                label="Archive note"
                onClick={() => void archive.run()}
              />
            )}
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
        className="line-clamp-2 min-h-0 rounded-sm py-0 pr-4 text-left text-sm leading-snug whitespace-pre-line wrap-anywhere text-foreground/85 outline-none after:absolute after:inset-0 after:rounded-xl"
      >
        {markdownToPlainText(note.body)}
      </button>
    </BoardCard>
  );
}
