import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveFromOpenNotes } from "./optimistic";

export function useCompleteNote() {
  const completeNote = useMutation(api.notes.markDone).withOptimisticUpdate(
    (localStore, args) => optimisticallyRemoveFromOpenNotes(localStore, args),
  );

  return (id: Id<"tasks">) => completeNote({ id });
}
