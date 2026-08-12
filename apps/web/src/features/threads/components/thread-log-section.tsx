import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";

import { useCreateActivityLog } from "../use-create-thread-log";
import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadId: Id<"threads">;
}

const PAGE_SIZE = 20;

export function ActivityLogSection({ threadId }: ActivityLogSectionProps) {
  // `usePaginatedQuery` keys its page cache by args, so the args must be the
  // Thread's stable identity for as long as this section stays mounted — the
  // `_id`, never the slug.
  const { results, status, loadMore } = usePaginatedQuery(
    api.activityLogs.listByThread,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  );
  const createLog = useCreateActivityLog();

  return (
    <ActivityLog
      logs={status === "LoadingFirstPage" ? undefined : results}
      canLoadMore={status === "CanLoadMore"}
      isLoadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(PAGE_SIZE)}
      onAddNote={async (content) => {
        await createLog({ threadId, content });
      }}
    />
  );
}
