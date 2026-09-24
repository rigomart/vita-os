import type { NoteId } from "@vita-os/contracts";

import { useCompleteNote as useCompleteNoteCommand } from "./hooks";

export function useCompleteNote() {
  const complete = useCompleteNoteCommand();

  return (noteId: NoteId) => complete.mutateAsync({ noteId });
}
