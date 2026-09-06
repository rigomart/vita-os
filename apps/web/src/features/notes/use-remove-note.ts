import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveFromOpenNotes } from "./optimistic";

export function useRemoveNote() {
  const removeNote = useMutation(api.notes.remove).withOptimisticUpdate(
    (localStore, args) => optimisticallyRemoveFromOpenNotes(localStore, args),
  );

  return (id: Id<"tasks">) => removeNote({ id });
}
