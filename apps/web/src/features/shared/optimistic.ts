import type { OptimisticLocalStore } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

type QueryValue<Query extends FunctionReference<"query">> = NonNullable<
  FunctionReturnType<Query>
>;

/**
 * Rewrite one cached query result. A query the client has no answer for yet —
 * never loaded, or loaded as a missing document — is left alone: there is
 * nothing to patch, and the server sends the real value soon enough.
 */
export function patchQuery<Query extends FunctionReference<"query">>(
  localStore: OptimisticLocalStore,
  query: Query,
  args: FunctionArgs<Query>,
  patch: (value: QueryValue<Query>) => FunctionReturnType<Query>,
): void {
  const value = localStore.getQuery(query, args);
  if (value === undefined || value === null) return;

  localStore.setQuery(query, args, patch(value));
}

/** `patchQuery` over every argument set the client holds for a query. */
export function patchAllQueries<Query extends FunctionReference<"query">>(
  localStore: OptimisticLocalStore,
  query: Query,
  patch: (
    value: QueryValue<Query>,
    args: FunctionArgs<Query>,
  ) => FunctionReturnType<Query>,
): void {
  for (const { args, value } of localStore.getAllQueries(query)) {
    if (value === undefined || value === null) continue;

    localStore.setQuery(query, args, patch(value, args));
  }
}

export function patchById<T extends { _id: string }>(
  tasks: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return tasks.map((task) => (task._id === id ? { ...task, ...patch } : task));
}

export function removeById<T extends { _id: string }>(
  tasks: T[],
  id: string,
): T[] {
  return tasks.filter((task) => task._id !== id);
}

export function nextOrder(tasks: Array<{ order: number }>): number {
  return tasks.reduce((max, task) => Math.max(max, task.order), -1) + 1;
}
