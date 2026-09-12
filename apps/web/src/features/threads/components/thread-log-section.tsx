import type { ThreadId } from "@vita-os/contracts";

import { useThreadActivity } from "@/application/application-client-context";

import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadId: ThreadId;
  lastActivityAt?: number;
}

const PAGE_SIZE = 20;

export function ActivityLogSection({
  threadId,
  lastActivityAt,
}: ActivityLogSectionProps) {
  const { state, loadMore } = useThreadActivity(threadId, PAGE_SIZE);
  if (state.status === "error") throw new Error(state.error.message);

  const page = state.status === "ready" ? state.data : undefined;
  return (
    <ActivityLog
      logs={state.status === "not_found" ? [] : page?.entries}
      lastActivityAt={lastActivityAt}
      canLoadMore={page?.pagination === "can_load_more"}
      isLoadingMore={page?.pagination === "loading_more"}
      onLoadMore={loadMore}
    />
  );
}
