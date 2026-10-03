import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
  Page,
} from "@vita-os/contracts";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useApplicationClient } from "../application-client-provider";

export type PagedResult<TEntry> = UseInfiniteQueryResult<
  InfiniteData<Page<TEntry>>,
  ApplicationError
> & {
  /** Every entry read so far, in the order the service returned them. */
  entries: TEntry[];
};

/**
 * How the application reads a history that only grows.
 *
 * Pages already read stay read: asking for more adds to what is on screen rather
 * than replacing it, and the cursor the service handed back is the only way to
 * ask. Every bounded history in Vita OS — the Activity Log, Archived Notes, a
 * Thread's Archived Notes — reads exactly this way.
 *
 * `keepPrevious` holds what is on screen while a read under a new key — a new
 * search, say — is on its way, instead of flashing empty.
 */
export function usePagedApplicationQuery<TEntry>(options: {
  queryKey: QueryKey;
  run: (
    client: ApplicationClient,
    cursor: string | undefined,
  ) => Promise<OperationResult<Page<TEntry>>>;
  enabled?: boolean;
  keepPrevious?: boolean;
  throwOnError?: boolean;
}): PagedResult<TEntry> {
  const client = useApplicationClient();
  const query = useInfiniteQuery<
    Page<TEntry>,
    ApplicationError,
    InfiniteData<Page<TEntry>>,
    QueryKey,
    string | undefined
  >({
    queryKey: options.queryKey,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const result = await options.run(client, pageParam);
      if (!result.ok) throw result.error;
      return result.value;
    },
    getNextPageParam: (page) => page.nextCursor,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.keepPrevious ? { placeholderData: keepPreviousData } : {}),
    throwOnError: options.throwOnError ?? true,
  });

  return {
    ...query,
    entries: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}
