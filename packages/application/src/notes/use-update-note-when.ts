import type { NoteId } from "@vita-os/contracts";

import { useUpdateNoteAttentionDate } from "./hooks";

/** The Attention Date, set or cleared. */
export function useUpdateNoteWhen() {
  const updateAttentionDate = useUpdateNoteAttentionDate();

  return (noteId: NoteId, when: number | undefined) =>
    updateAttentionDate.mutateAsync({ noteId, when: when ?? null });
}
