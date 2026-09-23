import type { NoteId } from "@vita-os/contracts";

import { useUpdateNoteAttentionDate } from "./hooks";

/**
 * The Attention Date, set or cleared.
 *
 * The capture surfaces still call this date `when`; this is where that older
 * word meets the contract's own.
 */
export function useUpdateNoteWhen() {
  const updateAttentionDate = useUpdateNoteAttentionDate();

  return (noteId: NoteId, when: number | undefined) =>
    updateAttentionDate.mutateAsync({ noteId, attentionDate: when ?? null });
}
