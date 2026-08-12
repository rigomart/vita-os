import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";

export function useRemoveThread(thread: ProjectedThread) {
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveThread(localStore, args, { thread });
    },
  );

  return () => removeThread({ id: thread._id });
}
