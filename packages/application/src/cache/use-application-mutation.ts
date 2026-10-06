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
 * A command never retries by itself. Some of them — completing a Task —
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
   * `answered` is true once the service's answer follows it in the replay: a
   * command whose answer carries the whole change can then show nothing of
   * its own, so it never reapplies the change over a newer answer.
   */
  optimistic?: (
    cache: QueryClient,
    variables: TVariables,
    previousLocal: TLocal | undefined,
    answered: boolean,
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
  /**
   * Commands sharing a scope reach the service one at a time, in the order they
   * were issued, while each still shows its change at once. A command that
   * reads what the previous one wrote — the revision it must carry — needs it.
   */
  scope?: string;
  /** Names the command for `useMutationState`, so a surface can tell it is pending. */
  mutationKey?: readonly unknown[];
  /**
   * A reason to refuse the command outright, decided when it is issued and
   * before anything shows: the command fails with it and reaches nothing.
   */
  refuse?: (variables: TVariables, cache: QueryClient) => Error | undefined;
}

interface MutationBatch {
  pending: number;
  base: Map<string, [QueryKey, unknown]>;
  layers: Array<{ apply: () => void }>;
  invalidate: Map<string, QueryKey>;
  /** Pending commands per scope; a scope's memo goes when its count reaches 0. */
  scopes: Map<string, number>;
  /**
   * What commands noted for later commands in their scope's queue, keyed
   * `<scope>` or `<scope>:<name>`.
   */
  memo: Map<string, unknown>;
}

interface Snapshot<TLocal> {
  batch: MutationBatch;
  layer: { apply: () => void };
  local: TLocal | undefined;
}

// Keep successful commands in the batch until every overlapping command settles.
// Otherwise an older failure can restore data from before a newer success.
const batches = new WeakMap<QueryClient, MutationBatch>();

/**
 * A note a command leaves for the commands queued behind it in its scope,
 * dropped once that scope has no pending command. Reads can refetch while
 * another scope holds the batch open, so a note must not outlive its queue. `undefined` outside a batch.
 */
export function queueMemo(
  cache: QueryClient,
): Map<string, unknown> | undefined {
  return batches.get(cache)?.memo;
}

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

  /** One command of this hook has settled: leave the batch and its scope. */
  function release(batch: MutationBatch) {
    batch.pending -= 1;
    const scope = options.scope;
    if (scope === undefined) return;
    const left = (batch.scopes.get(scope) ?? 1) - 1;
    if (left > 0) {
      batch.scopes.set(scope, left);
      return;
    }
    batch.scopes.delete(scope);
    for (const key of batch.memo.keys()) {
      if (key === scope || key.startsWith(`${scope}:`)) batch.memo.delete(key);
    }
  }

  return useMutation<TValue, ApplicationError, TVariables, Snapshot<TLocal>>({
    retry: false,
    ...(options.scope === undefined ? {} : { scope: { id: options.scope } }),
    ...(options.mutationKey === undefined
      ? {}
      : { mutationKey: options.mutationKey }),
    mutationFn: async (variables) => {
      const result = await options.run(client, variables);
      if (!result.ok) throw result.error;
      return result.value;
    },
    onMutate: async (variables) => {
      const refusal = options.refuse?.(variables, cache);
      if (refusal !== undefined) throw refusal;
      let batch = batches.get(cache);
      if (!batch) {
        batch = {
          pending: 0,
          base: new Map(),
          layers: [],
          invalidate: new Map(),
          scopes: new Map(),
          memo: new Map(),
        };
        batches.set(cache, batch);
      }
      batch.pending += 1;
      if (options.scope !== undefined) {
        batch.scopes.set(
          options.scope,
          (batch.scopes.get(options.scope) ?? 0) + 1,
        );
      }
      let affected: QueryKey[];
      try {
        affected = options.affected(variables, cache);
        await Promise.all(
          affected.map((queryKey) => cache.cancelQueries({ queryKey })),
        );
      } catch (error) {
        // No snapshot exists, so onSettled will not release this command.
        release(batch);
        if (batch.pending === 0) batches.delete(cache);
        throw error;
      }
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
              false,
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
      snapshot.layer.apply = () => {
        snapshot.local = options.optimistic?.(
          cache,
          variables,
          snapshot.local,
          true,
        );
        options.reconcile?.(cache, value, variables, snapshot.local);
      };
    },
    onSettled: (_value, _error, _variables, snapshot) => {
      if (!snapshot) return;
      const { batch } = snapshot;
      replay(cache, batch);
      release(batch);
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
