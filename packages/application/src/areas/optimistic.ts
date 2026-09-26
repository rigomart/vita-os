import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  AreaId,
  AreaSummary,
  CreateAreaInput,
  Thread,
  ThreadDetail,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { generateSlug } from "@vita-os/core";

import {
  nextOrder,
  patchById,
  patchQueries,
  patchQuery,
  removeById,
} from "../cache/patch";
import { queryKeys } from "../query-keys";

/**
 * The pending Area, shaped like the one the service will send back.
 *
 * Its slug is minted with the service's own pattern but a different random
 * suffix, so it will not match the real slug.
 */
export function buildPendingArea(
  input: CreateAreaInput,
  minted: { id: AreaId; now: number; order: number },
): AreaSummary {
  return {
    _id: minted.id,
    name: input.name,
    slug: generateSlug(input.name),
    icon: input.icon,
    order: minted.order,
    createdAt: minted.now,
  };
}

/**
 * Exactly the reads one Area change can touch: the list, plus any Thread rail
 * showing this Area as its label.
 */
export function areaChangeKeys(
  cache: QueryClient,
  areaId?: AreaId,
): QueryKey[] {
  const keys: QueryKey[] = [queryKeys.areas.list()];
  if (areaId === undefined) return keys;

  for (const [queryKey, detail] of cache.getQueriesData<ThreadDetail | null>({
    queryKey: queryKeys.threads.details(),
  })) {
    if (detail?.area?._id === areaId) keys.push(queryKey);
  }

  return keys;
}

export function showPendingArea(
  cache: QueryClient,
  input: CreateAreaInput,
  minted: { id: AreaId; now: number },
): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) => [
    ...areas,
    buildPendingArea(input, { ...minted, order: nextOrder(areas) }),
  ]);
}

/**
 * Replace the pending Area with the one the service answered with. A create
 * whose name matched an Area already listed answers with that Area, so the
 * placeholder is dropped rather than turned into a second copy of it.
 */
export function settlePendingArea(
  cache: QueryClient,
  pendingId: AreaId,
  area: AreaSummary,
): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) => {
    if (areas.some((existing) => existing._id === area._id)) {
      return removeById(areas, pendingId);
    }
    return areas.map((existing) =>
      existing._id === pendingId ? area : existing,
    );
  });
}

export function showAreaChange(
  cache: QueryClient,
  { areaId, ...change }: UpdateAreaInput,
): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
    patchById(areas, areaId, change),
  );
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail?.area?._id === areaId
        ? { ...detail, area: { ...detail.area, ...change } }
        : detail,
  );
}

/** Put the listed Areas in the given order, renumbering each position. */
export function showAreaOrder(
  cache: QueryClient,
  areaIds: readonly AreaId[],
): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) => {
    const byId = new Map(areas.map((area) => [area._id, area]));
    const ordered = areaIds.flatMap((areaId, order) => {
      const area = byId.get(areaId);
      return area === undefined ? [] : [{ ...area, order }];
    });
    return ordered.length === areas.length ? ordered : areas;
  });
}

/**
 * Deleting an Area takes it out of the list and its label off every cached
 * Thread that carries it. The Threads themselves stay where they are.
 */
export function showAreaRemoval(cache: QueryClient, areaId: AreaId): void {
  const unlabel = (thread: Thread): Thread => {
    if (thread.areaId !== areaId) return thread;
    const { areaId: _removed, ...rest } = thread;
    return rest;
  };

  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
    removeById(areas, areaId),
  );
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    threads.map(unlabel),
  );
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail?.area?._id === areaId
        ? { thread: unlabel(detail.thread) }
        : detail,
  );
}
