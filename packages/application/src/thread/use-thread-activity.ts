import type {
  ActivityLogEntry,
  ActivityLogPage,
  ApplicationError,
  ThreadId,
} from "@vita-os/contracts";

import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";

import { useApplicationClient } from "../application-client-provider";
import { threadQueryKeys } from "./query-keys";

export type ThreadActivityResult = UseInfiniteQueryResult<
  InfiniteData<ActivityLogPage>,
  ApplicationError
> & {
  entries: ActivityLogEntry[];
};

export function useThreadActivity(
  threadId: ThreadId,
  limit = 20,
): ThreadActivityResult {
  const client = useApplicationClient();
  const query = useInfiniteQuery<
    ActivityLogPage,
    ApplicationError,
    InfiniteData<ActivityLogPage>,
    ReturnType<typeof threadQueryKeys.activityPage>,
    string | undefined
  >({
    queryKey: threadQueryKeys.activityPage(threadId, limit),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const result = await client.getThreadActivityPage({
        threadId,
        limit,
        cursor: pageParam,
      });
      if (!result.ok) throw result.error;
      return result.value;
    },
    getNextPageParam: (page) => page.nextCursor,
  });

  return {
    ...query,
    entries: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}
