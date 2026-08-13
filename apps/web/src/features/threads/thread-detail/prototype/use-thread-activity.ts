// PROTOTYPE(thread-view) — throwaway. Shared data wiring for the thread-view
// UI variants so each variant file stays pure presentation. Delete this whole
// directory when a variant wins.
import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";

import { useCreateActivityLog } from "@/features/threads/use-create-thread-log";

const PAGE_SIZE = 20;

/** Same data contract as the production ActivityLogSection, exposed as a
 *  hook so prototype variants can lay out timeline + composer freely. */
export function useThreadActivity(threadId: Id<"threads">) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.activityLogs.listByThread,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  );
  const createLog = useCreateActivityLog();

  return {
    logs: status === "LoadingFirstPage" ? undefined : results,
    canLoadMore: status === "CanLoadMore",
    isLoadingMore: status === "LoadingMore",
    loadMore: () => loadMore(PAGE_SIZE),
    addNote: async (content: string) => {
      await createLog({ threadId, content });
    },
  };
}
