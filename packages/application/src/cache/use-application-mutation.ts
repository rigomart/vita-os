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

import {
  hashKey,
  notifyManager,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

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
   * pending record, say — is handed back to `reconcile`. This callback must only
   * change the cache: it can be replayed when another command settles.
   */
  optimistic?: (
    cache: QueryClient,
    variables: TVariables,
    previousLocal: TLocal | undefined,
  ) => TLocal;
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

interface MutationBatch {
  pending: number;
  base: Map<string, [QueryKey, unknown]>;
  layers: Array<{ apply: () => void }>;
  invalidate: Map<string, QueryKey>;
}

interface Snapshot<TLocal> {
  batch: MutationBatch;
  layer: { apply: () => void };
  local: TLocal | undefined;
}

// Keep successful commands in the batch until every overlapping command settles.
// Otherwise an older failure can restore data from before a newer success.
const batches = new WeakMap<QueryClient, MutationBatch>();

function replay(cache: QueryClient, batch: MutationBatch) {
  notifyManager.batch(() => {
    for (const [key, value] of batch.base.values())
      cache.setQueryData(key, value);
    for (const layer of batch.layers) layer.apply();
  });
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
      let batch = batches.get(cache);
      if (!batch) {
        batch = {
          pending: 0,
          base: new Map(),
          layers: [],
          invalidate: new Map(),
        };
        batches.set(cache, batch);
      }
      batch.pending += 1;
      const affected = options.affected(variables, cache);
      await Promise.all(
        affected.map((queryKey) => cache.cancelQueries({ queryKey })),
      );
      for (const key of [
        ...affected,
        ...(options.alsoInvalidate?.(variables, cache) ?? []),
      ])
        batch.invalidate.set(hashKey(key), key);
      for (const queryKey of affected) {
        for (const entry of cache.getQueriesData({ queryKey })) {
          const hash = hashKey(entry[0]);
          if (!batch.base.has(hash)) batch.base.set(hash, entry);
        }
      }
      const snapshot: Snapshot<TLocal> = {
        batch,
        layer: {
          apply: () => {
            snapshot.local = options.optimistic?.(
              cache,
              variables,
              snapshot.local,
            );
          },
        },
        local: undefined,
      };
      batch.layers.push(snapshot.layer);
      snapshot.layer.apply();
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot) snapshot.layer.apply = () => {};
    },
    onSuccess: (value, variables, snapshot) => {
      if (!snapshot) return;
      const optimistic = snapshot.layer.apply;
      snapshot.layer.apply = () => {
        optimistic();
        options.reconcile?.(cache, value, variables, snapshot.local);
      };
    },
    onSettled: (_value, _error, _variables, snapshot) => {
      if (!snapshot) return;
      const { batch } = snapshot;
      replay(cache, batch);
      batch.pending -= 1;
      // Refetching while a command is pending would erase its optimistic changes.
      if (batch.pending !== 0) return;
      batches.delete(cache);
      return Promise.all(
        [...batch.invalidate.values()].map((queryKey) =>
          cache.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}
