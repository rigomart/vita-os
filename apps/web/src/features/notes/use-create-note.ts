import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyAddToOpenNotes } from "./optimistic";

export type CreateNoteValue = {
  body: string;
  when?: number;
};

export function useCreateNote() {
  const createNote = useMutation(api.notes.create).withOptimisticUpdate(
    (localStore, args) => {
      const now = Date.now();

      optimisticallyAddToOpenNotes(localStore, {
        _id: crypto.randomUUID() as Id<"tasks">,
        _creationTime: now,
        body: args.body,
        when: args.when,
        state: "open",
        createdAt: now,
        updatedAt: now,
      });
    },
  );

  return (value: CreateNoteValue) => createNote(value);
}
