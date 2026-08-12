import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";

export function useRemoveThread(thread: Doc<"threads">) {
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveThread(localStore, args, { thread });
    },
  );

  return () => removeThread({ id: thread._id });
}
