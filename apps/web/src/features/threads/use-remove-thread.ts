import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";
import type { Thread } from "@vita-os/contracts";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";

export function useRemoveThread(thread: Thread) {
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveThread(localStore, args, {
        thread: thread as ProjectedThread,
      });
    },
  );

  return () => removeThread({ id: thread._id as Id<"threads"> });
}
