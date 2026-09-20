import type { NoteId } from "@vita-os/contracts";

import { useUpdateNoteBody as useUpdateNoteBodyCommand } from "./hooks";

export function useUpdateNoteBody() {
  const updateBody = useUpdateNoteBodyCommand();

  return (noteId: NoteId, body: string) =>
    updateBody.mutateAsync({ noteId, body });
}
