import type { AreaId, Thread, ThreadId } from "@vita-os/contracts";

import type { ThreadView } from "@/features/threads/thread-view";

import { useApplicationClient } from "@/application/application-client-context";

export function useCompleteNextMove(thread: ThreadView) {
  const client = useApplicationClient();

  return async () => {
    const applicationThread: Thread = {
      ...thread,
      _id: thread._id as ThreadId,
      areaId: thread.areaId as AreaId,
    };
    const result = await client.completeNextMove({
      threadId: applicationThread._id,
      thread: applicationThread,
    });
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
}
