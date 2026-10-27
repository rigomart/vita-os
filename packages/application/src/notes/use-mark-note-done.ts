import type { NoteId } from "@vita-os/contracts";

import { useMarkNoteDone as useMarkNoteDoneCommand } from "./hooks";

export function useMarkNoteDone() {
  const markDone = useMarkNoteDoneCommand();

  return (noteId: NoteId) => markDone.mutateAsync({ noteId });
}
