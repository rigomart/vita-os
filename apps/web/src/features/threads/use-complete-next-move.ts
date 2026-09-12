import type { Thread } from "@vita-os/contracts";

import { useApplicationClient } from "@/application/application-client-context";

export function useCompleteNextMove(thread: Thread) {
  const client = useApplicationClient();

  return async () => {
    const result = await client.completeNextMove({
      threadId: thread._id,
      thread,
    });
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
}
