import type { OptimisticLocalStore } from "convex/browser";

import { getFunctionName } from "convex/server";

/**
 * A stand-in for the Convex client's optimistic query cache, so the update
 * functions can be exercised as plain functions. Entries are keyed the way the
 * client keys them: query name plus arguments.
 */
export function createLocalStore() {
  const entries: Array<{
    query: string;
    args: unknown;
    value: unknown;
  }> = [];

  const queryKey = (query: unknown) => getFunctionName(query as never);
  const findEntry = (query: unknown, args: unknown) =>
    entries.find(
      (entry) =>
        entry.query === queryKey(query) &&
        JSON.stringify(entry.args) === JSON.stringify(args),
    );

  const set = (query: unknown, args: unknown, value: unknown) => {
    const entry = findEntry(query, args);
    if (entry) {
      entry.value = value;
    } else {
      entries.push({ query: queryKey(query), args, value });
    }
  };

  return {
    store: {
      getQuery(query: unknown, args: unknown) {
        return findEntry(query, args)?.value;
      },
      getAllQueries(query: unknown) {
        return entries
          .filter((entry) => entry.query === queryKey(query))
          .map((entry) => ({ args: entry.args, value: entry.value }));
      },
      setQuery: set,
    } as OptimisticLocalStore,
    set,
    get(query: unknown, args: unknown) {
      return findEntry(query, args)?.value;
    },
  };
}
