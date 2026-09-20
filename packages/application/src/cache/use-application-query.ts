import type { QueryKey, UseQueryResult } from "@tanstack/react-query";
import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

import { useQuery } from "@tanstack/react-query";

import { useApplicationClient } from "../application-client-provider";

/**
 * How the application reads.
 *
 * A read fetches when something observes it and refreshes stale data on mount,
 * on focus, and on reconnect. Nothing polls. A failure is the caller's to render
 * or to let rise to an error boundary, the way it always was.
 */
export function useApplicationQuery<T>(options: {
  queryKey: QueryKey;
  run: (client: ApplicationClient) => Promise<OperationResult<T>>;
  enabled?: boolean;
  throwOnError?: boolean;
}): UseQueryResult<T, ApplicationError> {
  const client = useApplicationClient();

  return useQuery<T, ApplicationError>({
    queryKey: options.queryKey,
    queryFn: async () => {
      const result = await options.run(client);
      if (!result.ok) throw result.error;
      return result.value;
    },
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.throwOnError === undefined
      ? {}
      : { throwOnError: options.throwOnError }),
  });
}

/**
 * A read of something that may simply not be there.
 *
 * A record that is missing — or that belongs to somebody else, which is the same
 * answer — reads as `null` rather than as a failure, so a screen keeps its own
 * not-found state instead of collapsing into an error.
 */
export function useOptionalApplicationQuery<T>(options: {
  queryKey: QueryKey;
  run: (client: ApplicationClient) => Promise<OperationResult<T>>;
  enabled?: boolean;
  throwOnError?: boolean;
}): UseQueryResult<T | null, ApplicationError> {
  const client = useApplicationClient();

  return useQuery<T | null, ApplicationError>({
    queryKey: options.queryKey,
    queryFn: async () => {
      const result = await options.run(client);
      if (result.ok) return result.value;
      if (result.error.code === "not_found") return null;
      throw result.error;
    },
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.throwOnError === undefined
      ? {}
      : { throwOnError: options.throwOnError }),
  });
}
