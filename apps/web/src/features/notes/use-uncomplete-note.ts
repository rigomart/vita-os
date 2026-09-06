import type { ProjectedNote } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyReopenNote } from "./optimistic";

export function useUncompleteNote() {
  const uncompleteNote = useMutation(api.notes.markOpen);

  return (note: ProjectedNote) =>
    uncompleteNote.withOptimisticUpdate((localStore) =>
      optimisticallyReopenNote(localStore, note),
    )({ id: note._id });
}
