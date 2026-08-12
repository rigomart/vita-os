import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";

import {
  nextOrder,
  patchById,
  patchQuery,
  removeById,
} from "@/features/shared/optimistic";

type Thread = Doc<"threads">;

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

export function optimisticallyCreateThreadInList(
  localStore: OptimisticLocalStore,
  args: CreateThreadArgs,
): void {
  patchQuery(localStore, api.threads.list, {}, (threads) => [
    ...threads,
    buildOptimisticThread(args, {
      id: crypto.randomUUID() as Id<"threads">,
      now: Date.now(),
      order: nextOrder(threads),
    }),
  ]);
}

export function optimisticallyCreateThreadInArea(
  localStore: OptimisticLocalStore,
  args: CreateThreadArgs,
  options: { areaId: Id<"areas"> },
): void {
  patchQuery(
    localStore,
    api.threads.listByArea,
    { areaId: options.areaId },
    (threads) => [
      ...threads,
      buildOptimisticThread(args, {
        id: crypto.randomUUID() as Id<"threads">,
        now: Date.now(),
        order: nextOrder(threads),
      }),
    ],
  );
}

export function optimisticallyUpdateThread(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads">; resolutionNote?: string } & ThreadPatch,
  options: { threadSlug: string },
): void {
  const { id, resolutionNote: _resolutionNote, ...updates } = args;
  const patch = nullsToUndefined(updates);
  const threadPatch =
    patch.state === "resolved"
      ? { ...patch, nextMove: undefined, followUp: undefined }
      : patch;

  const bySlug = localStore.getQuery(api.threads.getBySlug, {
    slug: options.threadSlug,
  });

  patchQuery(localStore, api.threads.list, {}, (threads) =>
    threadPatch.state === "resolved"
      ? removeById(threads, id)
      : patchById(threads, id, threadPatch),
  );

  patchQuery(localStore, api.threads.get, { id }, (thread) => ({
    ...thread,
    ...threadPatch,
  }));

  patchQuery(
    localStore,
    api.threads.getBySlug,
    { slug: options.threadSlug },
    (thread) => ({ ...thread, ...threadPatch }),
  );

  if (
    (threadPatch.areaId !== undefined || threadPatch.state === "resolved") &&
    bySlug !== undefined &&
    bySlug !== null
  ) {
    const previousAreaId = bySlug.areaId;
    if (
      previousAreaId !== threadPatch.areaId ||
      threadPatch.state === "resolved"
    ) {
      patchQuery(
        localStore,
        api.threads.listByArea,
        { areaId: previousAreaId },
        (threads) => removeById(threads, id),
      );

      if (
        threadPatch.areaId !== undefined &&
        threadPatch.state !== "resolved"
      ) {
        patchQuery(
          localStore,
          api.threads.listByArea,
          { areaId: threadPatch.areaId },
          (threads) => [...threads, { ...bySlug, ...threadPatch }],
        );
      }
    }
  }
}

export function optimisticallyRemoveThread(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  options: { threadSlug?: string; areaId?: Id<"areas"> } = {},
): void {
  patchQuery(localStore, api.threads.list, {}, (threads) =>
    removeById(threads, args.id),
  );

  if (options.areaId !== undefined) {
    patchQuery(
      localStore,
      api.threads.listByArea,
      { areaId: options.areaId },
      (threads) => removeById(threads, args.id),
    );
  }

  localStore.setQuery(api.threads.get, { id: args.id }, null);
  if (options.threadSlug !== undefined) {
    localStore.setQuery(
      api.threads.getBySlug,
      { slug: options.threadSlug },
      null,
    );
  }
}

export function optimisticallyCompleteNextMove(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  options: { threadSlug: string },
): void {
  patchQuery(localStore, api.threads.list, {}, (threads) =>
    threads.map((thread) =>
      thread._id === args.id ? completeNextMove(thread) : thread,
    ),
  );

  patchQuery(localStore, api.threads.get, { id: args.id }, completeNextMove);

  patchQuery(
    localStore,
    api.threads.getBySlug,
    { slug: options.threadSlug },
    completeNextMove,
  );
}
