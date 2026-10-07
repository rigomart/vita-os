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

export interface OptimisticChange<TLocal = void> {
  local?: TLocal;
  rollback(): void;
}
export interface ApplicationMutationOptions<TVariables, TValue, TLocal = void> {
  run: (
    client: ApplicationClient,
    variables: TVariables,
  ) => Promise<OperationResult<TValue>>;
  affected: (variables: TVariables, cache: QueryClient) => QueryKey[];
  optimistic?: (
    cache: QueryClient,
    variables: TVariables,
  ) => OptimisticChange<TLocal>;
  reconcile?: (
    cache: QueryClient,
    value: TValue,
    variables: TVariables,
    local: TLocal | undefined,
  ) => void;
  alsoInvalidate?: (variables: TVariables, cache: QueryClient) => QueryKey[];
  mutationKey?: readonly unknown[];
}
interface MutationContext<TLocal> {
  affected: QueryKey[];
  optimistic?: OptimisticChange<TLocal>;
}
export type ApplicationMutationResult<
  TVariables,
  TValue,
  TLocal = void,
> = UseMutationResult<
  TValue,
  ApplicationError,
  TVariables,
  MutationContext<TLocal>
>;

/** Apply once, undo only this command on failure, and refetch as soon as it settles. */
export function useApplicationMutation<TVariables, TValue, TLocal = void>(
  options: ApplicationMutationOptions<TVariables, TValue, TLocal>,
): ApplicationMutationResult<TVariables, TValue, TLocal> {
  const client = useApplicationClient();
  const cache = useQueryClient();
  return useMutation<
    TValue,
    ApplicationError,
    TVariables,
    MutationContext<TLocal>
  >({
    retry: false,
    ...(options.mutationKey === undefined
      ? {}
      : { mutationKey: options.mutationKey }),
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
      const optimistic = options.optimistic?.(cache, variables);
      return { affected, ...(optimistic === undefined ? {} : { optimistic }) };
    },
    onError: (_error, _variables, context) => context?.optimistic?.rollback(),
    onSuccess: (value, variables, context) =>
      options.reconcile?.(cache, value, variables, context?.optimistic?.local),
    onSettled: (_value, _error, variables, context) =>
      Promise.all(
        [
          ...(context?.affected ?? options.affected(variables, cache)),
          ...(options.alsoInvalidate?.(variables, cache) ?? []),
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      ),
  });
}
