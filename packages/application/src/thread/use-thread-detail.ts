import type { ApplicationError, ThreadDetail } from "@vita-os/contracts";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useApplicationClient } from "../application-client-provider";
import { threadQueryKeys } from "./query-keys";

export function useThreadDetail(
  slug: string,
): UseQueryResult<ThreadDetail, ApplicationError> {
  const client = useApplicationClient();

  return useQuery({
    queryKey: threadQueryKeys.detail(slug),
    queryFn: async () => {
      const result = await client.getThreadDetail({ slug });
      if (!result.ok) throw result.error;
      return result.value;
    },
  });
}
