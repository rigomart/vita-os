import type { NoteId } from "@vita-os/contracts";

import { useCompleteNote as useCompleteNoteCommand } from "@vita-os/application";

export function useCompleteNote() {
  const complete = useCompleteNoteCommand();

  return (noteId: NoteId) => complete.mutateAsync({ noteId });
}
