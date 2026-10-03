import type { Note } from "@vita-os/contracts";

import { useUnarchiveNote as useUnarchiveNoteCommand } from "./hooks";

/**
 * Unarchiving takes the whole Note: an Archived Note is not in the Open Notes
 * for the optimistic change to rebuild it from.
 */
export function useUnarchiveNote() {
  const unarchive = useUnarchiveNoteCommand();

  return (note: Note) => unarchive.mutateAsync({ note });
}
