import type { Note } from "@vita-os/contracts";

import { NotebookPen } from "lucide-react";

import { useCompleteNote } from "../../notes/use-complete-note";
import { useUpdateNoteBody } from "../../notes/use-update-note-body";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import { EditableField } from "../../ui/editable-field";
import {
  BoardCard,
  BoardCompleteButton,
  BoardDate,
  BoardTag,
  isLate,
} from "./board-card";

/**
 * A standalone Note on the board, in the same `BoardCard` as a Thread. The
 * frame the Note wears on the Notes page belongs to writing surfaces; here it
 * sits among Threads being triaged, so it takes their shape and tells itself
 * apart by what it says instead — the body in regular weight where a Thread
 * has a bold title, and a Note tag where a Thread has its Area.
 *
 * The body is still the writing surface: click it to edit in place, the same
 * way a Note edits in the Notes panel and on a Thread.
 */
export function DashboardNote({
  currentDate,
  note,
  onTray,
}: {
  currentDate: number;
  note: Note;
  onTray?: boolean;
}) {
  const completeNote = useCompleteNote();
  const updateNoteBody = useUpdateNoteBody();
  const updateNoteWhen = useUpdateNoteWhen();

  const when = note.attentionDate ?? undefined;
  const attentionDate = (
    <BoardDate
      currentDate={currentDate}
      labels={{ change: "Change attention date", set: "Set attention date" }}
      onSetWhen={(next) => void updateNoteWhen(note._id, next)}
      when={when}
    />
  );

  return (
    <BoardCard
      late={isLate(when, currentDate)}
      onTray={onTray}
      footer={
        <>
          {when !== undefined && attentionDate}
          <BoardTag
            icon={<NotebookPen aria-hidden className="size-3 shrink-0" />}
            label="Note"
          />

          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {when === undefined && attentionDate}
            <BoardCompleteButton
              label="Mark note done"
              onClick={() => void completeNote(note._id)}
            />
          </span>
        </>
      }
    >
      <EditableField
        value={note.body}
        variant="textarea"
        onSave={(text) => {
          if (!text) return;
          void updateNoteBody(note._id, text);
        }}
        inputAriaLabel="Edit note body"
        editOnFocus
        textareaRows={1}
        chromeless
        className="min-h-0 py-0 text-left text-sm leading-snug whitespace-pre-wrap wrap-anywhere text-foreground/85 caret-ring"
      />
    </BoardCard>
  );
}
