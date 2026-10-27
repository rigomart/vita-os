import type { Note } from "@vita-os/contracts";

import { useMarkNoteOpen as useMarkNoteOpenCommand } from "./hooks";

/**
 * Reopening takes the whole Note: a Completed Note is not in the Open Notes
 * for the optimistic change to rebuild it from.
 */
export function useMarkNoteOpen() {
  const reopen = useMarkNoteOpenCommand();

  return (note: Note) => reopen.mutateAsync({ note });
}
