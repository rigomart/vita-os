import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { patchQuery } from "@/features/shared/optimistic";

import { updateNoteWhenInInbox } from "./optimistic";

export function useUpdateNoteWhen() {
  const updateNoteWhen = useMutation(api.notes.updateWhen).withOptimisticUpdate(
    (localStore, args) => {
      patchQuery(localStore, api.notes.list, {}, (notes) =>
        updateNoteWhenInInbox(notes, args.id, args.when),
      );
    },
  );

  return (id: Id<"tasks">, when: number | undefined) =>
    updateNoteWhen({ id, when });
}
