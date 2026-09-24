import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  AreaDetail,
  AreaId,
  AreaSummary,
  CreateThreadInput,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";

import {
  clearedToAbsent,
  decideNextMoveCompletion,
  generateSlug,
  storedUpNext,
  takeFrontUpNextMove,
} from "@vita-os/core";

import { patchAreaDetail } from "../areas/optimistic";
import {
  insertOrdered,
  nextOrder,
  patchById,
  patchQueries,
  patchQuery,
  removeById,
} from "../cache/patch";
import { queryKeys } from "../query-keys";

/** Whatever a read holds of a Thread's attention state. */
type AttentionFields = { nextMove?: string; upNext?: string[] };

/**
 * The Up Next invariant, mirrored from the service: while the line holds moves,
 * the Next Move slot is full. Every local change that could empty the slot runs
 * through here, so the promotion the service is about to make is already on
 * screen.
 */
function fillNextMoveFromUpNext<T extends AttentionFields>(thread: T): T {
  if (thread.nextMove) return thread;

  const promotion = takeFrontUpNextMove(thread.upNext);
  return promotion ? { ...thread, ...promotion } : thread;
}

export function completeNextMoveLocally<T extends AttentionFields>(
  thread: T,
): T {
  const decision = decideNextMoveCompletion(thread);
  return decision.status === "unchanged"
    ? thread
    : { ...thread, ...decision.patch };
}

/** The whole line, rewritten — the shape every Up Next edit sends. */
export function replaceUpNextLocally<T extends AttentionFields>(
  thread: T,
  moves: readonly string[],
): T {
  return fillNextMoveFromUpNext({ ...thread, upNext: storedUpNext(moves) });
}

/**
 * The pending Thread, shaped like the one the service will send back. Its slug is
 * a placeholder: a link built from it resolves only once the create has returned
 * the slug the service chose.
 */
export function buildPendingThread(
  input: CreateThreadInput,
  minted: { id: ThreadId; now: number; order: number },
): Thread {
  return {
    _id: minted.id,
    title: input.title,
    slug: generateSlug(input.title),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    areaId: input.areaId,
    order: minted.order,
    state: "open",
    createdAt: minted.now,
    revision: 0,
  };
}

/**
 * Patch every cached Thread detail holding this Thread, matched on what the read
 * holds — a command never knows the slug the rail subscribed with. Returning
 * `null` drops the Thread from the rail.
 */
function patchThreadDetail(
  cache: QueryClient,
  threadId: ThreadId,
  patch: (detail: ThreadDetail) => ThreadDetail | null,
): void {
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail !== null && detail.thread._id === threadId
        ? patch(detail)
        : detail,
  );
}

/**
 * Exactly the reads one Thread change can touch.
 *
 * Named from what the cache actually holds rather than from the whole key family,
 * so a command against one Thread neither snapshots nor invalidates another
 * Thread's rail or an unrelated Area's page.
 */
export function threadChangeKeys(
  cache: QueryClient,
  target: { threadId?: ThreadId; areaIds?: Array<AreaId | undefined> },
): QueryKey[] {
  const keys: QueryKey[] = [queryKeys.threads.open()];
  const areaIds = new Set(
    (target.areaIds ?? []).filter(
      (areaId): areaId is AreaId => areaId !== undefined,
    ),
  );

  for (const [queryKey, detail] of cache.getQueriesData<ThreadDetail | null>({
    queryKey: queryKeys.threads.details(),
  })) {
    if (
      target.threadId !== undefined &&
      detail !== null &&
      detail?.thread._id === target.threadId
    ) {
      keys.push(queryKey);
    }
  }

  for (const [queryKey, detail] of cache.getQueriesData<AreaDetail | null>({
    queryKey: queryKeys.areas.details(),
  })) {
    if (detail === null || detail === undefined) continue;

    const holdsThread =
      target.threadId !== undefined &&
      detail.threads.some((thread) => thread._id === target.threadId);
    if (holdsThread || areaIds.has(detail.area._id)) keys.push(queryKey);
  }

  return keys;
}

export function showPendingThread(
  cache: QueryClient,
  input: CreateThreadInput,
  minted: { id: ThreadId; now: number },
): void {
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) => [
    ...threads,
    buildPendingThread(input, { ...minted, order: nextOrder(threads) }),
  ]);
  patchAreaDetail(cache, input.areaId, (detail) => ({
    ...detail,
    threads: [
      ...detail.threads,
      // Each read computes its own position: they hold different subsets.
      buildPendingThread(input, {
        ...minted,
        order: nextOrder(detail.threads),
      }),
    ],
  }));
}

export function settlePendingThread(
  cache: QueryClient,
  pendingId: ThreadId,
  thread: Thread,
): void {
  const swap = (threads: Thread[]) =>
    threads.map((existing) => (existing._id === pendingId ? thread : existing));

  patchQuery<Thread[]>(cache, queryKeys.threads.open(), swap);
  patchAreaDetail(cache, thread.areaId, (detail) => ({
    ...detail,
    threads: swap(detail.threads),
  }));
}

/**
 * One Thread change, across every read that can be holding it.
 *
 * `thread` is the Thread as the caller sees it: the basis for inserts into reads
 * that do not hold it yet, and the only source of the Area it is leaving. It is
 * never discovered from the cache, because a destination read can be cached while
 * the Thread's own list is not. `destinationArea` is the Area a move targets;
 * without it the rail's embedded Area is left for the service to reconcile.
 */
export function showThreadChange(
  cache: QueryClient,
  input: UpdateThreadInput,
  context: { thread: Thread; destinationArea?: AreaSummary },
): void {
  const { threadId, resolutionNote: _resolutionNote, ...requested } = input;
  const patch = clearedToAbsent(requested);
  // Resolving takes the whole attention state with it. Any other change that
  // empties the slot promotes the front of Up Next into it instead, and the
  // promotion has to travel in the patch: reads are patched field by field, not
  // replaced with the Thread the caller handed us.
  const attentionPatch: AttentionFields & { followUp?: number } =
    patch.state === "resolved"
      ? { nextMove: undefined, upNext: undefined, followUp: undefined }
      : Object.hasOwn(patch, "nextMove")
        ? fillNextMoveFromUpNext({
            nextMove: patch.nextMove,
            upNext: context.thread.upNext,
          })
        : {};
  const threadPatch: Partial<Thread> = { ...patch, ...attentionPatch };
  const next = { ...context.thread, ...threadPatch };
  const resolved = threadPatch.state === "resolved";
  const reopened = threadPatch.state === "open";
  const destination =
    threadPatch.areaId !== undefined &&
    threadPatch.areaId !== context.thread.areaId
      ? threadPatch.areaId
      : undefined;

  // A reopened Thread is absent from the open-only reads, so patching by ID would
  // silently do nothing: it is inserted where the list's ordering puts it. An
  // ordinary field change never inserts — a Thread that is missing stays missing.
  const patchOpenList = (
    threads: Thread[],
    key: (thread: Thread) => number,
  ): Thread[] => {
    if (threads.some((thread) => thread._id === threadId)) {
      return patchById(threads, threadId, threadPatch);
    }
    return reopened ? insertOrdered(threads, next, key) : threads;
  };

  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    resolved
      ? removeById(threads, threadId)
      : patchOpenList(threads, (thread) => thread.order),
  );

  patchThreadDetail(cache, threadId, (detail) => ({
    ...detail,
    thread: { ...detail.thread, ...threadPatch },
    area:
      destination !== undefined && context.destinationArea !== undefined
        ? context.destinationArea
        : detail.area,
  }));

  patchAreaDetail(cache, context.thread.areaId, (detail) => ({
    ...detail,
    threads:
      destination !== undefined || resolved
        ? removeById(detail.threads, threadId)
        : // The Area inventory reads in creation order, not manual order.
          patchOpenList(detail.threads, (thread) => thread.createdAt),
  }));

  if (destination !== undefined && !resolved) {
    patchAreaDetail(cache, destination, (detail) => ({
      ...detail,
      threads: [...detail.threads, next],
    }));
  }
}

/**
 * Deleting a Thread takes it out of every read holding it: the open list, any
 * rail showing it, and the inventory of whichever Area it was filed under.
 */
export function showThreadRemoval(
  cache: QueryClient,
  threadId: ThreadId,
): void {
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    removeById(threads, threadId),
  );
  patchThreadDetail(cache, threadId, () => null);
  patchQueries<AreaDetail | null>(cache, queryKeys.areas.details(), (detail) =>
    detail === null
      ? detail
      : { ...detail, threads: removeById(detail.threads, threadId) },
  );
}

/**
 * Both attention changes land in the same three reads, differing only in what
 * they do to the Thread they find: the open list, every cached rail holding it,
 * and every Area page listing it.
 */
export function showThreadAttention(
  cache: QueryClient,
  threadId: ThreadId,
  patch: <T extends AttentionFields>(thread: T) => T,
): void {
  const patchList = <T extends AttentionFields & { _id: string }>(
    threads: T[],
  ) =>
    threads.map((thread) => (thread._id === threadId ? patch(thread) : thread));

  patchQuery<Thread[]>(cache, queryKeys.threads.open(), patchList);
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail !== null && detail.thread._id === threadId
        ? { ...detail, thread: patch(detail.thread) }
        : detail,
  );
  patchQueries<AreaDetail | null>(cache, queryKeys.areas.details(), (detail) =>
    detail === null
      ? detail
      : { ...detail, threads: patchList(detail.threads) },
  );
}
