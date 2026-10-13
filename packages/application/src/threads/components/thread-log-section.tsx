import type { ThreadId } from "@vita-os/contracts";

import { useThreadActivity } from "../hooks";
import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadId: ThreadId;
}

const PAGE_SIZE = 20;

export function ActivityLogSection({ threadId }: ActivityLogSectionProps) {
  const activity = useThreadActivity(threadId, PAGE_SIZE);
  if (activity.error !== null) throw new Error(activity.error.message);

  return (
    <ActivityLog
      logs={activity.isPending ? undefined : activity.entries}
      canLoadMore={activity.hasNextPage && !activity.isFetchingNextPage}
      isLoadingMore={activity.isFetchingNextPage}
      onLoadMore={() => void activity.fetchNextPage()}
    />
  );
}
