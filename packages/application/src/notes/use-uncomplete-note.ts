import type { Note } from "@vita-os/contracts";

import { useReopenNote } from "./hooks";

/**
 * Reopening takes the whole Note: a Done Note is not in the Open Notes for the
 * optimistic change to rebuild it from.
 */
export function useUncompleteNote() {
  const reopen = useReopenNote();

  return (note: Note) => reopen.mutateAsync({ note });
}
