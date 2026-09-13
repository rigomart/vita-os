import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import type { ThreadView } from "@/features/threads/thread-view";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";

export function useRemoveThread(thread: ThreadView) {
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveThread(localStore, args, {
        thread: thread as unknown as ProjectedThread,
      });
    },
  );

  return () => removeThread({ id: thread._id as Id<"threads"> });
}
