import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";

import { patchAreaDetail } from "@/features/areas/optimistic";
import {
  nextOrder,
  patchAllQueries,
  patchById,
  patchQuery,
  removeById,
} from "@/features/shared/optimistic";

type Thread = Doc<"threads">;

type ThreadDetail = NonNullable<
  FunctionReturnType<typeof api.threads.detailBySlug>
>;

type CreateThreadArgs = {
  title: string;
  summary?: string;
  areaId: Id<"areas">;
};

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type ThreadPatch = NullablePatch<
  Pick<
    Thread,
    "title" | "summary" | "areaId" | "nextMove" | "followUp" | "state"
  >
>;

export function buildOptimisticThread(
  args: CreateThreadArgs,
  options: { id: Id<"threads">; now: number; order: number },
): Thread {
  return {
    _id: options.id,
    _creationTime: options.now,
    userId: "",
    title: args.title,
    summary: args.summary,
    areaId: args.areaId,
    order: options.order,
    state: "open",
    createdAt: options.now,
  };
}

export function completeNextMove<T extends { nextMove?: string }>(
  thread: T,
): T {
  return { ...thread, nextMove: undefined };
}

/**
 * Patch every cached `threads.detailBySlug` holding this Thread, matched on
 * the cached document's `_id` — the mutation never knows the slug the rail
 * subscribed with. Returning `null` drops the Thread from the rail.
 */
function patchThreadDetail(
  localStore: OptimisticLocalStore,
  threadId: Id<"threads">,
  patch: (detail: ThreadDetail) => ThreadDetail | null,
): void {
  patchAllQueries(localStore, api.threads.detailBySlug, (detail) =>
    detail.thread._id === threadId ? patch(detail) : detail,
  );
}

/**
 * One pending Thread across both caches: id and timestamps are minted once,
 * so the two caches hold the same document while the create is in flight.
 * Each list still computes its own `order` — they hold different subsets.
 */
export function optimisticallyCreateThread(
  localStore: OptimisticLocalStore,
  args: CreateThreadArgs,
): void {
  const minted = { id: crypto.randomUUID() as Id<"threads">, now: Date.now() };

  patchQuery(localStore, api.threads.list, {}, (threads) => [
    ...threads,
    buildOptimisticThread(args, { ...minted, order: nextOrder(threads) }),
  ]);
  patchAreaDetail(localStore, args.areaId, (detail) => ({
    ...detail,
    threads: [
      ...detail.threads,
      buildOptimisticThread(args, {
        ...minted,
        order: nextOrder(detail.threads),
      }),
    ],
  }));
}

/** Insert where a list's ascending `key` puts the document. */
function insertOrdered<T>(items: T[], item: T, key: (item: T) => number): T[] {
  const index = items.findIndex((existing) => key(existing) > key(item));
  return index === -1
    ? [...items, item]
    : [...items.slice(0, index), item, ...items.slice(index)];
}

/**
 * `context.thread` is the Thread as the caller sees it: the base for
 * destination inserts and the only source of the previous Area. It is never
 * discovered from the cache — a destination list can be cached while the
 * Thread's own list is not. `context.destinationArea` is the Area an
 * `areaId` move targets; when the caller cannot provide the document, the
 * rail's embedded Area is left for the server to reconcile.
 */
export function optimisticallyUpdateThread(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads">; resolutionNote?: string } & ThreadPatch,
  context: { thread: Thread; destinationArea?: Doc<"areas"> },
): void {
  const { id, resolutionNote: _resolutionNote, ...updates } = args;
  const patch = nullsToUndefined(updates);
  const threadPatch =
    patch.state === "resolved"
      ? { ...patch, nextMove: undefined, followUp: undefined }
      : patch;
  const next = { ...context.thread, ...threadPatch };
  const resolved = threadPatch.state === "resolved";
  const reopened = threadPatch.state === "open";
  const destination =
    threadPatch.areaId !== undefined &&
    threadPatch.areaId !== context.thread.areaId
      ? threadPatch.areaId
      : undefined;

  // A reopened Thread is absent from the open-only caches, so patching by id
  // would silently no-op: it is inserted where the list's ordering puts it.
  // Ordinary field patches never insert — a missing id stays missing.
  const patchOpenList = (
    threads: Thread[],
    key: (thread: Thread) => number,
  ): Thread[] => {
    if (threads.some((thread) => thread._id === id)) {
      return patchById(threads, id, threadPatch);
    }
    return reopened ? insertOrdered(threads, next, key) : threads;
  };

  patchQuery(localStore, api.threads.list, {}, (threads) =>
    resolved
      ? removeById(threads, id)
      : patchOpenList(threads, (thread) => thread.order),
  );

  patchThreadDetail(localStore, id, (detail) => ({
    ...detail,
    thread: next,
    area:
      destination !== undefined && context.destinationArea !== undefined
        ? context.destinationArea
        : detail.area,
  }));

  patchAreaDetail(localStore, context.thread.areaId, (detail) => ({
    ...detail,
    threads:
      destination !== undefined || resolved
        ? removeById(detail.threads, id)
        : // The Area inventory reads in creation order, not manual order.
          patchOpenList(detail.threads, (thread) => thread.createdAt),
  }));

  if (destination !== undefined && !resolved) {
    patchAreaDetail(localStore, destination, (detail) => ({
      ...detail,
      threads: [...detail.threads, next],
    }));
  }
}

export function optimisticallyRemoveThread(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  context: { thread: Thread },
): void {
  patchQuery(localStore, api.threads.list, {}, (threads) =>
    removeById(threads, args.id),
  );
  patchThreadDetail(localStore, args.id, () => null);
  patchAreaDetail(localStore, context.thread.areaId, (detail) => ({
    ...detail,
    threads: removeById(detail.threads, args.id),
  }));
}

export function optimisticallyCompleteNextMove(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  context: { thread: Thread },
): void {
  const clear = <T extends { _id: string; nextMove?: string }>(threads: T[]) =>
    threads.map((thread) =>
      thread._id === args.id ? completeNextMove(thread) : thread,
    );

  patchQuery(localStore, api.threads.list, {}, clear);
  patchThreadDetail(localStore, args.id, (detail) => ({
    ...detail,
    thread: completeNextMove(detail.thread),
  }));
  patchAreaDetail(localStore, context.thread.areaId, (detail) => ({
    ...detail,
    threads: clear(detail.threads),
  }));
}
