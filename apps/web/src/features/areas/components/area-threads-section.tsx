import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

import { AreaThreads } from "./area-threads";

interface AreaThreadsSectionProps {
  areaSlug: string;
  onCreateThread: () => void;
}

export function AreaThreadsSection({
  areaSlug,
  onCreateThread,
}: AreaThreadsSectionProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const threads = useQuery(
    api.threads.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (!area) return;
      optimisticallyRemoveThread(localStore, args, { areaId: area._id });
    },
  );

  return (
    <AreaThreads
      threads={threads ?? []}
      currentDate={Date.now()}
      isLoading={threads === undefined}
      onCreateThread={onCreateThread}
      onRemoveThread={(threadId) => removeThread({ id: threadId })}
    />
  );
}
