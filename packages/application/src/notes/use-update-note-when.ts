import type { NoteId } from "@vita-os/contracts";

import { useUpdateNoteFollowUp } from "./hooks";

/**
 * The Follow-up date, set or cleared.
 *
 * The capture surfaces still call this date `when`; this is where that older
 * word meets the contract's own.
 */
export function useUpdateNoteWhen() {
  const updateFollowUp = useUpdateNoteFollowUp();

  return (noteId: NoteId, when: number | undefined) =>
    updateFollowUp.mutateAsync({ noteId, followUp: when ?? null });
}
