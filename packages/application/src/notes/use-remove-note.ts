import type { NoteId } from "@vita-os/contracts";

import { useDiscardNote } from "./hooks";

export function useRemoveNote() {
  const discard = useDiscardNote();

  return (noteId: NoteId, undoWindow?: () => Promise<boolean>) =>
    discard.mutateAsync({ noteId, undoWindow });
}
