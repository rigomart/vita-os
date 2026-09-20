import type { NoteId } from "@vita-os/contracts";

import { useUpdateNoteBody as useUpdateNoteBodyCommand } from "@vita-os/application";

export function useUpdateNoteBody() {
  const updateBody = useUpdateNoteBodyCommand();

  return (noteId: NoteId, body: string) =>
    updateBody.mutateAsync({ noteId, body });
}
