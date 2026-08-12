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
 * Rewrite one cached query result. A query the client has no answer for is
 * left alone: `undefined` covers one never loaded, one still in flight, and
 * one whose last result was an error, and `null` covers a document that isn't
 * there. In each case there is nothing to patch and the server settles it.
 *
 * `patch` must be total. Convex replays optimistic updates from its server
 * ingest loop, which doesn't guard them, so a throw from here propagates out
 * and stops every query update until the page is reloaded.
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
