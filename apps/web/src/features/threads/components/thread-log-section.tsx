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
  // Keyed by `threadId`, not slug: `usePaginatedQuery` drops its loaded pages
  // when the args change, and a rename regenerates the slug.
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
