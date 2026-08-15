import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";
import { generateSlug } from "@convex/lib/slugs";
import { storedUpNext, takeFrontUpNextMove } from "@convex/lib/upNext";

import { patchAreaDetail } from "@/features/areas/optimistic";
import {
  nextOrder,
  patchAllQueries,
  patchById,
  patchQuery,
  removeById,
} from "@/features/shared/optimistic";

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
    ProjectedThread,
    "title" | "summary" | "areaId" | "nextMove" | "followUp" | "state"
  >
>;

/**
 * The pending Thread, shaped like the one the server will send back. Its slug
 * is a placeholder minted with the server's pattern but a different random
 * suffix, so it will NOT match the real slug — a link built from it only
 * resolves after navigation re-reads the slug the mutation returned.
 */
export function buildOptimisticThread(
  args: CreateThreadArgs,
  options: { id: Id<"threads">; now: number; order: number },
): ProjectedThread {
  return {
    _id: options.id,
    title: args.title,
    slug: generateSlug(args.title),
    summary: args.summary,
    areaId: args.areaId,
    order: options.order,
    state: "open",
    createdAt: options.now,
  };
}

/** Whatever the caches hold of a Thread's attention state. */
type AttentionFields = { nextMove?: string; upNext?: string[] };

/**
 * The Up Next invariant, mirrored from the server (convex/lib/threadChanges):
 * while the line holds moves, the Next Move slot is full. Every local write
 * that could empty the slot runs through here, so the promotion the server is
 * about to make is already on screen.
 */
function fillNextMoveFromUpNext<T extends AttentionFields>(thread: T): T {
  if (thread.nextMove) return thread;

  const promotion = takeFrontUpNextMove(thread.upNext);
  return promotion ? { ...thread, ...promotion } : thread;
}

export function completeNextMove<T extends AttentionFields>(thread: T): T {
  return fillNextMoveFromUpNext({ ...thread, nextMove: undefined });
}

/** The whole line, rewritten — the shape every Up Next edit sends. */
export function replaceUpNext<T extends AttentionFields>(
  thread: T,
  moves: readonly string[],
): T {
  return fillNextMoveFromUpNext({ ...thread, upNext: storedUpNext(moves) });
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
  context: { thread: ProjectedThread; destinationArea?: ProjectedArea },
): void {
  const { id, resolutionNote: _resolutionNote, ...updates } = args;
  const patch = nullsToUndefined(updates);
  // Resolving takes the whole attention state with it. Any other write that
  // empties the slot promotes the front of Up Next into it instead, and the
  // promotion has to travel in the patch: the caches are patched field by
  // field, not replaced with the Thread the caller handed us.
  const attentionPatch: AttentionFields & { followUp?: number } =
    patch.state === "resolved"
      ? { nextMove: undefined, upNext: undefined, followUp: undefined }
      : "nextMove" in patch
        ? fillNextMoveFromUpNext({
            nextMove: patch.nextMove,
            upNext: context.thread.upNext,
          })
        : {};
  const threadPatch = { ...patch, ...attentionPatch };
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
    threads: ProjectedThread[],
    key: (thread: ProjectedThread) => number,
  ): ProjectedThread[] => {
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
  context: { thread: ProjectedThread },
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

/**
 * Both attention writes land in the same three caches, differing only in what
 * they do to the Thread they find: the open list, every cached rail holding
 * it, and its Area page.
 */
function patchThreadAttention(
  localStore: OptimisticLocalStore,
  context: { id: Id<"threads">; areaId: Id<"areas"> },
  patch: <T extends AttentionFields>(thread: T) => T,
): void {
  const patchList = <T extends AttentionFields & { _id: string }>(
    threads: T[],
  ) =>
    threads.map((thread) =>
      thread._id === context.id ? patch(thread) : thread,
    );

  patchQuery(localStore, api.threads.list, {}, patchList);
  patchThreadDetail(localStore, context.id, (detail) => ({
    ...detail,
    thread: patch(detail.thread),
  }));
  patchAreaDetail(localStore, context.areaId, (detail) => ({
    ...detail,
    threads: patchList(detail.threads),
  }));
}

export function optimisticallyCompleteNextMove(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  context: { thread: ProjectedThread },
): void {
  patchThreadAttention(
    localStore,
    { id: args.id, areaId: context.thread.areaId },
    completeNextMove,
  );
}

/**
 * Up Next edits — add, edit, reorder, remove — all arrive as the whole ordered
 * line, so the local write is the same replacement the server will make.
 */
export function optimisticallyReplaceUpNext(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads">; moves: string[] },
  context: { thread: ProjectedThread },
): void {
  patchThreadAttention(
    localStore,
    { id: args.id, areaId: context.thread.areaId },
    (thread) => replaceUpNext(thread, args.moves),
  );
}
