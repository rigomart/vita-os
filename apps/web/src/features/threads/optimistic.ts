import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import type { OptimisticLocalStore } from "convex/browser";
import { nextOrder, patchById, removeById } from "@/features/shared/optimistic";

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
  const current = localStore.getQuery(api.threads.list, {});
  if (current === undefined) return;

  localStore.setQuery(api.threads.list, {}, [
    ...current,
    buildOptimisticThread(args, {
      id: crypto.randomUUID() as Id<"threads">,
      now: Date.now(),
      order: nextOrder(current),
    }),
  ]);
}

export function optimisticallyCreateThreadInArea(
  localStore: OptimisticLocalStore,
  args: CreateThreadArgs,
  options: { areaId: Id<"areas"> },
): void {
  const current = localStore.getQuery(api.threads.listByArea, {
    areaId: options.areaId,
  });
  if (current === undefined) return;

  localStore.setQuery(api.threads.listByArea, { areaId: options.areaId }, [
    ...current,
    buildOptimisticThread(args, {
      id: crypto.randomUUID() as Id<"threads">,
      now: Date.now(),
      order: nextOrder(current),
    }),
  ]);
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

  const current = localStore.getQuery(api.threads.list, {});
  if (current !== undefined) {
    localStore.setQuery(
      api.threads.list,
      {},
      threadPatch.state === "resolved"
        ? removeById(current, id)
        : patchById(current, id, threadPatch),
    );
  }

  const single = localStore.getQuery(api.threads.get, { id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(api.threads.get, { id }, { ...single, ...threadPatch });
  }

  const bySlug = localStore.getQuery(api.threads.getBySlug, {
    slug: options.threadSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.threads.getBySlug,
      { slug: options.threadSlug },
      { ...bySlug, ...threadPatch },
    );
  }

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
      const previousAreaThreads = localStore.getQuery(api.threads.listByArea, {
        areaId: previousAreaId,
      });
      if (previousAreaThreads !== undefined) {
        localStore.setQuery(
          api.threads.listByArea,
          { areaId: previousAreaId },
          removeById(previousAreaThreads, id),
        );
      }

      if (
        threadPatch.areaId !== undefined &&
        threadPatch.state !== "resolved"
      ) {
        const nextAreaThreads = localStore.getQuery(api.threads.listByArea, {
          areaId: threadPatch.areaId,
        });
        if (nextAreaThreads !== undefined) {
          localStore.setQuery(
            api.threads.listByArea,
            { areaId: threadPatch.areaId },
            [...nextAreaThreads, { ...bySlug, ...threadPatch }],
          );
        }
      }
    }
  }
}

export function optimisticallyRemoveThread(
  localStore: OptimisticLocalStore,
  args: { id: Id<"threads"> },
  options: { threadSlug?: string; areaId?: Id<"areas"> } = {},
): void {
  const current = localStore.getQuery(api.threads.list, {});
  if (current !== undefined) {
    localStore.setQuery(api.threads.list, {}, removeById(current, args.id));
  }

  if (options.areaId !== undefined) {
    const areaThreads = localStore.getQuery(api.threads.listByArea, {
      areaId: options.areaId,
    });
    if (areaThreads !== undefined) {
      localStore.setQuery(
        api.threads.listByArea,
        { areaId: options.areaId },
        removeById(areaThreads, args.id),
      );
    }
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
  const current = localStore.getQuery(api.threads.list, {});
  if (current !== undefined) {
    localStore.setQuery(
      api.threads.list,
      {},
      current.map((thread) =>
        thread._id === args.id ? completeNextMove(thread) : thread,
      ),
    );
  }

  const single = localStore.getQuery(api.threads.get, { id: args.id });
  if (single !== undefined && single !== null) {
    localStore.setQuery(
      api.threads.get,
      { id: args.id },
      completeNextMove(single),
    );
  }

  const bySlug = localStore.getQuery(api.threads.getBySlug, {
    slug: options.threadSlug,
  });
  if (bySlug !== undefined && bySlug !== null) {
    localStore.setQuery(
      api.threads.getBySlug,
      { slug: options.threadSlug },
      completeNextMove(bySlug),
    );
  }
}
