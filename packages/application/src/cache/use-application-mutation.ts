import type {
  QueryClient,
  QueryKey,
  UseMutationResult,
} from "@tanstack/react-query";
import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApplicationClient } from "../application-client-provider";

/**
 * What every Vita OS command does to the reads on screen.
 *
 * The shape is the same for all of them, so it lives here once: cancel the reads
 * the command touches, remember exactly what they held, apply the change the
 * service is about to make, and then either fold in the service's own answer or
 * put the remembered values back. Related reads are invalidated afterwards either
 * way, so what is visible converges on the service.
 *
 * A command never retries by itself. Some of them — completing a Next Move —
 * would target something different the second time.
 */
export interface ApplicationMutationOptions<TVariables, TValue, TLocal = void> {
  /** The operation itself, named on the application client. */
  run: (
    client: ApplicationClient,
    variables: TVariables,
  ) => Promise<OperationResult<TValue>>;
  /**
   * The reads this command can change, cancelled and restored as a set.
   *
   * It sees the cache so it can name only the reads that actually hold the
   * record: an unrelated Thread's rail is neither snapshotted nor invalidated.
   */
  affected: (variables: TVariables, cache: QueryClient) => QueryKey[];
  /**
   * The change to show immediately. Whatever it returns — the ID it minted for a
   * pending record, say — is handed back to `reconcile`.
   */
  optimistic?: (cache: QueryClient, variables: TVariables) => TLocal;
  /** The service's answer, folded into what is on screen. */
  reconcile?: (
    cache: QueryClient,
    value: TValue,
    variables: TVariables,
    local: TLocal | undefined,
  ) => void;
  /** Reads to invalidate once the command settles, beyond the affected ones. */
  alsoInvalidate?: (variables: TVariables, cache: QueryClient) => QueryKey[];
}

interface Snapshot<TLocal> {
  entries: Array<[QueryKey, unknown]>;
  invalidate: QueryKey[];
  local: TLocal | undefined;
}

export type ApplicationMutationResult<
  TVariables,
  TValue,
  TLocal = void,
> = UseMutationResult<TValue, ApplicationError, TVariables, Snapshot<TLocal>>;

export function useApplicationMutation<TVariables, TValue, TLocal = void>(
  options: ApplicationMutationOptions<TVariables, TValue, TLocal>,
): ApplicationMutationResult<TVariables, TValue, TLocal> {
  const client = useApplicationClient();
  const cache = useQueryClient();

  return useMutation<TValue, ApplicationError, TVariables, Snapshot<TLocal>>({
    retry: false,
    mutationFn: async (variables) => {
      const result = await options.run(client, variables);
      if (!result.ok) throw result.error;
      return result.value;
    },
    onMutate: async (variables) => {
      const affected = options.affected(variables, cache);
      await Promise.all(
        affected.map((queryKey) => cache.cancelQueries({ queryKey })),
      );

      const entries = affected.flatMap((queryKey) =>
        cache.getQueriesData({ queryKey }),
      );
      const local = options.optimistic?.(cache, variables);

      return {
        entries,
        invalidate: [
          ...affected,
          ...(options.alsoInvalidate?.(variables, cache) ?? []),
        ],
        local,
      };
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot === undefined) return;

      for (const [queryKey, data] of snapshot.entries) {
        cache.setQueryData(queryKey, data);
      }
    },
    onSuccess: (value, variables, snapshot) => {
      options.reconcile?.(cache, value, variables, snapshot?.local);
    },
    onSettled: (_value, _error, _variables, snapshot) => {
      if (snapshot === undefined) return;

      return Promise.all(
        snapshot.invalidate.map((queryKey) =>
          cache.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}
