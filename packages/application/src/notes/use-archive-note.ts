import type { NoteId } from "@vita-os/contracts";

import { useArchiveNote as useArchiveNoteCommand } from "./hooks";

export function useArchiveNote() {
  const archive = useArchiveNoteCommand();

  return (noteId: NoteId) => archive.mutateAsync({ noteId });
}
