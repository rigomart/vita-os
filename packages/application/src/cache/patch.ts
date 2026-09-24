import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { Page } from "@vita-os/contracts";

/**
 * Rewriting what the application already holds.
 *
 * An optimistic change patches the reads that are on screen and leaves the rest
 * alone: a read the application has no answer for has nothing to patch, and the
 * server settles it on the next fetch. Every patch is total — it must not throw,
 * because a half-applied cache is worse than a slightly stale one.
 */

/** Patch one cached read, if it is cached at all. */
export function patchQuery<T>(
  client: QueryClient,
  key: QueryKey,
  patch: (value: T) => T,
): void {
  const value = client.getQueryData<T>(key);
  if (value === undefined || value === null) return;

  client.setQueryData<T>(key, patch(value));
}

/**
 * Patch every cached read under one key family — every Area detail, say, whatever
 * slug it was read by. The patch sees the key so it can tell them apart.
 */
export function patchQueries<T>(
  client: QueryClient,
  key: QueryKey,
  patch: (value: T, key: QueryKey) => T,
): void {
  for (const [queryKey, value] of client.getQueriesData<T>({ queryKey: key })) {
    if (value === undefined || value === null) continue;

    client.setQueryData<T>(queryKey, patch(value, queryKey));
  }
}

export function patchById<T extends { _id: string }>(
  records: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return records.map((record) =>
    record._id === id ? { ...record, ...patch } : record,
  );
}

export function removeById<T extends { _id: string }>(
  records: T[],
  id: string,
): T[] {
  return records.filter((record) => record._id !== id);
}

/** The manual position a new record takes at the end of an ordered list. */
export function nextOrder(records: Array<{ order: number }>): number {
  return records.reduce((max, record) => Math.max(max, record.order), -1) + 1;
}

/** Insert where a list's ascending `key` puts the record. */
export function insertOrdered<T>(
  records: T[],
  record: T,
  key: (record: T) => number,
): T[] {
  const index = records.findIndex((existing) => key(existing) > key(record));
  return index === -1
    ? [...records, record]
    : [...records.slice(0, index), record, ...records.slice(index)];
}

/**
 * Insert where a newest-first list puts the record: descending `key`, ties broken
 * by descending ID — the same order the service reads.
 */
export function insertNewestFirst<T extends { _id: string }>(
  records: T[],
  record: T,
  key: (record: T) => number,
): T[] {
  const index = records.findIndex((existing) =>
    key(record) === key(existing)
      ? record._id > existing._id
      : key(record) > key(existing),
  );
  return index === -1
    ? [...records, record]
    : [...records.slice(0, index), record, ...records.slice(index)];
}

/** Update entries already loaded without changing the service's pagination cursors. */
export function patchPagedEntries<T>(
  cache: QueryClient,
  key: QueryKey,
  patch: (entries: T[]) => T[],
): void {
  patchQueries<InfiniteData<Page<T>>>(cache, key, (data) => ({
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: patch(page.entries),
    })),
  }));
}
