import type { NoteId } from "@vita-os/contracts";

import { useDiscardNote } from "./hooks";

export function useRemoveNote() {
  const discard = useDiscardNote();

  return (noteId: NoteId) => discard.mutateAsync({ noteId });
}
