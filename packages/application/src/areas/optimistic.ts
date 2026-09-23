import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  AreaDetail,
  AreaId,
  AreaSummary,
  CreateAreaInput,
  UpdateAreaInput,
  ThreadDetail,
} from "@vita-os/contracts";

import { clearedToAbsent, generateSlug } from "@vita-os/core";

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
 * suffix, so it will not match the real slug: a link built from it resolves only
 * after the create has come back with the slug the service chose.
 */
export function buildPendingArea(
  input: CreateAreaInput,
  minted: { id: AreaId; now: number; order: number },
): AreaSummary {
  return {
    _id: minted.id,
    name: input.name,
    slug: generateSlug(input.name),
    ...(input.standard === undefined ? {} : { standard: input.standard }),
    condition: input.condition,
    icon: input.icon,
    order: minted.order,
    createdAt: minted.now,
  };
}

/**
 * Patch every cached Area detail holding this Area. The reads are keyed by slug
 * while a command names its target by ID, so the match runs on what the read
 * holds rather than on the command's own arguments.
 */
export function patchAreaDetail(
  cache: QueryClient,
  areaId: AreaId,
  patch: (detail: AreaDetail) => AreaDetail | null,
): void {
  patchQueries<AreaDetail | null>(cache, queryKeys.areas.details(), (detail) =>
    detail !== null && detail.area._id === areaId ? patch(detail) : detail,
  );
}

/**
 * Exactly the reads one Area change can touch: the inventory, plus any Area page
 * that is holding this Area. Another Area's page is left alone.
 */
export function areaChangeKeys(
  cache: QueryClient,
  areaId?: AreaId,
): QueryKey[] {
  const keys: QueryKey[] = [queryKeys.areas.list()];
  if (areaId === undefined) return keys;

  for (const [queryKey, detail] of cache.getQueriesData<AreaDetail | null>({
    queryKey: queryKeys.areas.details(),
  })) {
    if (detail !== null && detail?.area._id === areaId) keys.push(queryKey);
  }

  for (const [queryKey, detail] of cache.getQueriesData<ThreadDetail | null>({
    queryKey: queryKeys.threads.details(),
  })) {
    if (detail?.area._id === areaId) keys.push(queryKey);
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

/** Replace the pending Area with the one the service actually stored. */
export function settlePendingArea(
  cache: QueryClient,
  pendingId: AreaId,
  area: AreaSummary,
): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
    areas.some((existing) => existing._id === pendingId)
      ? areas.map((existing) => (existing._id === pendingId ? area : existing))
      : areas,
  );
}

export function showAreaChange(
  cache: QueryClient,
  { areaId, ...change }: UpdateAreaInput,
): void {
  const patch = clearedToAbsent(change);

  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
    patchById(areas, areaId, patch),
  );
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail?.area._id === areaId
        ? { ...detail, area: { ...detail.area, ...patch } }
        : detail,
  );
  patchAreaDetail(cache, areaId, (detail) => ({
    ...detail,
    area: { ...detail.area, ...patch },
  }));
}

export function showAreaRemoval(cache: QueryClient, areaId: AreaId): void {
  patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
    removeById(areas, areaId),
  );
  patchAreaDetail(cache, areaId, () => null);
}
