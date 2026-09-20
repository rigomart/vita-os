import type { NoteId } from "@vita-os/contracts";

import { useDiscardNote } from "@vita-os/application";

export function useRemoveNote() {
  const discard = useDiscardNote();

  return (noteId: NoteId) => discard.mutateAsync({ noteId });
}
