import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";

import { useStableQuery } from "@/hooks/use-stable-query";

import { useCreateActivityLog } from "../use-create-thread-log";
import { ActivityLog } from "./thread-log";

interface ActivityLogSectionProps {
  threadSlug: string;
}

const PAGE_SIZE = 20;

export function ActivityLogSection({ threadSlug }: ActivityLogSectionProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const { results, status, loadMore } = usePaginatedQuery(
    api.activityLogs.listByThread,
    thread ? { threadId: thread._id } : "skip",
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
        if (!thread) return;
        await createLog({ threadId: thread._id, content });
      }}
    />
  );
}
