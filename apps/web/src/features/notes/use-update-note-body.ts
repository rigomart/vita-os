import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { patchQuery } from "@/features/shared/optimistic";

import { updateNoteBodyInInbox } from "./optimistic";

export function useUpdateNoteBody() {
  const updateNoteBody = useMutation(api.notes.updateBody).withOptimisticUpdate(
    (localStore, args) => {
      patchQuery(localStore, api.notes.list, {}, (notes) =>
        updateNoteBodyInInbox(notes, args.id, args.body),
      );
    },
  );

  return (id: Id<"tasks">, body: string) => updateNoteBody({ id, body });
}
