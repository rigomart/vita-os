import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { optimisticallyRemoveThread } from "@/features/threads/optimistic";

export function useRemoveThread(options: {
  threadSlug?: string;
  areaId?: Id<"areas">;
}) {
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveThread(localStore, args, options);
    },
  );

  return (id: Id<"threads">) => removeThread({ id });
}
