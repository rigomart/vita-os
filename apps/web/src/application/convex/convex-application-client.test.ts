import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type {
  ActivityLogEntry,
  AreaId,
  AreaSummary,
  Thread,
  ThreadId,
} from "@vita-os/contracts";
import type { OptimisticLocalStore } from "convex/browser";
import type { ConvexReactClient } from "convex/react";

import { api } from "@convex/_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "@convex/test.helpers";
import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import type {
  ConvexActivityLogEntry,
  ConvexApplicationGateway,
  ConvexPaginatedWatch,
  ConvexCompletionGateway,
  ConvexProjectedThreadDetail,
  ConvexWatch,
} from "./convex-application-client";

import {
  completeNextMoveThroughConvex,
  createConvexApplicationClient,
  createConvexGateway,
  createThreadActivityResource,
  createThreadDetailResource,
  toApplicationError,
} from "./convex-application-client";

const area = {
  _id: "area1" as AreaId,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "needs_attention",
  order: 0,
  createdAt: 1,
} satisfies AreaSummary;

const thread = {
  _id: "thread1" as ThreadId,
  title: "Book checkup",
  slug: "book-checkup",
  areaId: area._id,
  order: 0,
  state: "open",
  nextMove: "Call clinic",
  upNext: ["Book appointment"],
  createdAt: 2,
} satisfies Thread;

const convexArea = {
  ...area,
  _id: area._id as unknown as Id<"areas">,
} satisfies ProjectedArea;

const convexThread = {
  ...thread,
  _id: thread._id as unknown as Id<"threads">,
  areaId: thread.areaId as unknown as Id<"areas">,
} satisfies ProjectedThread;

class MutableWatch<T> implements ConvexWatch<T> {
  private error: Error | undefined;
  private listeners = new Set<() => void>();
  private value: T | undefined;

  onUpdate(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  localQueryResult(): T | undefined {
    if (this.error) throw this.error;
    return this.value;
  }

  publish(value: T): void {
    this.error = undefined;
    this.value = value;
    for (const listener of this.listeners) listener();
  }

  fail(error: Error): void {
    this.error = error;
    for (const listener of this.listeners) listener();
  }
}

class MutablePaginatedWatch<T> implements ConvexPaginatedWatch<T> {
  private listeners = new Set<() => void>();
  private result:
    | {
        results: T[];
        status:
          | "LoadingFirstPage"
          | "CanLoadMore"
          | "LoadingMore"
          | "Exhausted";
        loadMore: (pageSize: number) => boolean;
      }
    | undefined;

  onUpdate(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  localQueryResult() {
    return this.result;
  }

  publish(
    results: T[],
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted",
  ): void {
    this.result = {
      results,
      status,
      loadMore: () => {
        this.publish(results, "LoadingMore");
        return true;
      },
    };
    for (const listener of this.listeners) listener();
  }
}

describe("Convex application client", () => {
  it("publishes Thread detail and stops listening after cleanup", () => {
    const watch = new MutableWatch<ConvexProjectedThreadDetail | null>();
    const resource = createThreadDetailResource(() => watch);
    const onChange = vi.fn();

    expect(resource.getSnapshot()).toEqual({ status: "loading" });

    const unsubscribe = resource.subscribe(onChange);
    watch.publish({ thread: convexThread, area: convexArea });

    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { thread, area },
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    watch.publish(null);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("represents a missing Thread without exposing backend details", () => {
    const watch = new MutableWatch<ConvexProjectedThreadDetail | null>();
    const resource = createThreadDetailResource(() => watch);
    const unsubscribe = resource.subscribe(() => undefined);

    watch.publish(null);

    expect(resource.getSnapshot()).toEqual({ status: "not_found" });
    unsubscribe();
  });

  it("represents a failed subscription with a transport-neutral error", () => {
    const watch = new MutableWatch<ConvexProjectedThreadDetail | null>();
    const resource = createThreadDetailResource(() => watch);
    const unsubscribe = resource.subscribe(() => undefined);

    watch.fail(new Error("WebSocket disconnected"));

    expect(resource.getSnapshot()).toEqual({
      status: "error",
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
        retryable: true,
      },
    });
    unsubscribe();
  });

  it("normalizes an unauthenticated Convex failure", () => {
    expect(toApplicationError(new Error("Unauthenticated"))).toEqual({
      code: "unauthorized",
      message: "You are not authorized to access this Thread.",
      retryable: false,
    });
  });

  it("preserves Activity Log pagination behind the public resource", () => {
    const watch = new MutablePaginatedWatch<ActivityLogEntry>();
    const resource = createThreadActivityResource(() => watch, 20);
    const unsubscribe = resource.subscribe(() => undefined);
    const entry = {
      _id: "log1",
      type: "next_action_change",
      content: 'Completed "Call clinic" — next move cleared',
      previousValue: "Call clinic",
      createdAt: 10,
    } satisfies ActivityLogEntry;

    watch.publish([entry], "CanLoadMore");
    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { entries: [entry], pagination: "can_load_more" },
    });

    resource.loadMore();
    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { entries: [entry], pagination: "loading_more" },
    });
    unsubscribe();
  });

  it("optimistically promotes Up Next through the existing Convex caches", async () => {
    const localStore = createLocalStore();
    localStore.set(api.threads.list, {}, [convexThread]);
    localStore.set(
      api.threads.detailBySlug,
      { slug: thread.slug },
      { thread: convexThread, area: convexArea },
    );
    localStore.set(
      api.areas.detailBySlug,
      { slug: area.slug },
      { area: convexArea, threads: [convexThread] },
    );
    const convex = {
      mutation: async (
        reference: unknown,
        input: { id: Id<"threads"> },
        options: {
          optimisticUpdate: (
            store: OptimisticLocalStore,
            args: { id: Id<"threads"> },
          ) => void;
        },
      ) => {
        expect(getFunctionName(reference as never)).toBe(
          "threads:completeNextMoveMutation",
        );
        expect(input).toEqual({ id: convexThread._id });
        options.optimisticUpdate(localStore.store, input);
        return { status: "completed" };
      },
      watchQuery: () => new MutableWatch<ConvexProjectedThreadDetail | null>(),
      watchPaginatedQuery: () =>
        new MutablePaginatedWatch<ConvexActivityLogEntry>(),
    } as unknown as ConvexReactClient;

    const outcome = await completeNextMoveThroughConvex(
      createConvexGateway(convex),
      {
        threadId: thread._id,
        thread,
      },
    );

    const promoted = {
      ...convexThread,
      nextMove: "Book appointment",
      upNext: undefined,
    };
    expect(outcome).toEqual({
      ok: true,
      value: { status: "completed" },
    });
    expect(localStore.get(api.threads.list, {})).toEqual([promoted]);
    expect(
      localStore.get(api.threads.detailBySlug, { slug: thread.slug }),
    ).toEqual({ thread: promoted, area: convexArea });
    expect(localStore.get(api.areas.detailBySlug, { slug: area.slug })).toEqual(
      { area: convexArea, threads: [promoted] },
    );
  });

  it("exposes Convex rollback after a failed optimistic completion", async () => {
    const authoritativeStore = createLocalStore();
    authoritativeStore.set(api.threads.list, {}, [convexThread]);
    authoritativeStore.set(
      api.threads.detailBySlug,
      { slug: thread.slug },
      { thread: convexThread, area: convexArea },
    );
    authoritativeStore.set(
      api.areas.detailBySlug,
      { slug: area.slug },
      { area: convexArea, threads: [convexThread] },
    );
    let optimisticThread: ProjectedThread | undefined;
    const gateway: ConvexCompletionGateway = {
      completeNextMove: async (input, optimisticUpdate) => {
        const optimisticLayer = createLocalStore();
        optimisticLayer.set(api.threads.list, {}, [convexThread]);
        optimisticLayer.set(
          api.threads.detailBySlug,
          { slug: thread.slug },
          { thread: convexThread, area: convexArea },
        );
        optimisticLayer.set(
          api.areas.detailBySlug,
          { slug: area.slug },
          { area: convexArea, threads: [convexThread] },
        );

        optimisticUpdate(optimisticLayer.store, input);
        optimisticThread = (
          optimisticLayer.get(api.threads.list, {}) as ProjectedThread[]
        )[0];

        // A rejected Convex mutation discards its separate optimistic layer.
        // The authoritative cache was never rewritten by the application.
        throw new Error("WebSocket disconnected");
      },
    };

    const outcome = await completeNextMoveThroughConvex(gateway, {
      threadId: thread._id,
      thread,
    });

    expect(outcome).toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
        retryable: true,
      },
    });
    expect(optimisticThread?.nextMove).toBe("Book appointment");
    expect(authoritativeStore.get(api.threads.list, {})).toEqual([
      convexThread,
    ]);
    expect(
      authoritativeStore.get(api.threads.detailBySlug, { slug: thread.slug }),
    ).toEqual({ thread: convexThread, area: convexArea });
    expect(
      authoritativeStore.get(api.areas.detailBySlug, { slug: area.slug }),
    ).toEqual({ area: convexArea, threads: [convexThread] });
  });

  it("hides missing and foreign Threads behind the same client error", async () => {
    const gateway: ConvexCompletionGateway = {
      completeNextMove: () => Promise.reject(new Error("Thread not found")),
    };

    const outcome = await completeNextMoveThroughConvex(gateway, {
      threadId: thread._id,
      thread,
    });

    expect(outcome).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Thread not found.",
        retryable: false,
      },
    });
  });

  it("exposes Thread detail through the complete application client", () => {
    const detailWatch = new MutableWatch<ConvexProjectedThreadDetail | null>();
    const activityWatch = new MutablePaginatedWatch<ActivityLogEntry>();
    const gateway: ConvexApplicationGateway = {
      watchThreadDetail: () => detailWatch,
      watchThreadActivity: () => activityWatch,
      completeNextMove: async () => ({ status: "unchanged" }),
    };
    const client = createConvexApplicationClient(gateway);
    const resource = client.watchThreadDetail({ slug: thread.slug });
    const unsubscribe = resource.subscribe(() => undefined);

    detailWatch.publish({ thread: convexThread, area: convexArea });

    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { thread, area },
    });
    unsubscribe();
  });

  it("delivers a public mutation's confirmed updates to a second client", async () => {
    const backend = setupTest();
    const owner = await signIn(backend, "adapter-owner@example.com");
    const fixture = await seed(owner);
    await owner.mutation(api.threads.replaceUpNext, {
      id: fixture.threadId,
      moves: ["Book appointment"],
    });

    const detailWatches: Array<{
      slug: string;
      watch: MutableWatch<ConvexProjectedThreadDetail | null>;
    }> = [];
    const activityWatches: Array<{
      threadId: ThreadId;
      watch: MutablePaginatedWatch<ConvexActivityLogEntry>;
    }> = [];

    async function publishConfirmedState(): Promise<void> {
      await Promise.all([
        ...detailWatches.map(async ({ slug, watch }) => {
          watch.publish(await owner.query(api.threads.detailBySlug, { slug }));
        }),
        ...activityWatches.map(async ({ threadId, watch }) => {
          const result = await owner.query(api.activityLogs.listByThread, {
            threadId: threadId as unknown as Id<"threads">,
            paginationOpts: FIRST_PAGE,
          });
          watch.publish(result.page, "Exhausted");
        }),
      ]);
    }

    function connectedGateway(): ConvexApplicationGateway {
      return {
        watchThreadDetail: ({ slug }) => {
          const watch = new MutableWatch<ConvexProjectedThreadDetail | null>();
          detailWatches.push({ slug, watch });
          return watch;
        },
        watchThreadActivity: ({ threadId }) => {
          const watch = new MutablePaginatedWatch<ConvexActivityLogEntry>();
          activityWatches.push({ threadId, watch });
          return watch;
        },
        completeNextMove: async ({ id }) => {
          const result = await owner.mutation(
            api.threads.completeNextMoveMutation,
            { id },
          );
          await publishConfirmedState();
          return result;
        },
      };
    }

    const first = createConvexApplicationClient(connectedGateway());
    const second = createConvexApplicationClient(connectedGateway());
    const firstDetail = first.watchThreadDetail({ slug: fixture.threadSlug });
    const secondDetail = second.watchThreadDetail({ slug: fixture.threadSlug });
    const firstActivity = first.watchThreadActivity({
      threadId: fixture.threadId as unknown as ThreadId,
      initialPageSize: 20,
    });
    const secondActivity = second.watchThreadActivity({
      threadId: fixture.threadId as unknown as ThreadId,
      initialPageSize: 20,
    });
    const cleanups = [
      firstDetail.subscribe(() => undefined),
      secondDetail.subscribe(() => undefined),
      firstActivity.subscribe(() => undefined),
      secondActivity.subscribe(() => undefined),
    ];

    await publishConfirmedState();
    const before = firstDetail.getSnapshot();
    if (before.status !== "ready") throw new Error("Thread did not load");

    await first.completeNextMove({
      threadId: before.data.thread._id,
      thread: before.data.thread,
    });

    for (const resource of [firstDetail, secondDetail]) {
      const snapshot = resource.getSnapshot();
      expect(snapshot).toMatchObject({
        status: "ready",
        data: {
          thread: { nextMove: "Book appointment" },
        },
      });
      if (snapshot.status !== "ready") throw new Error("Thread did not load");
      expect(snapshot.data.thread.upNext).toBeUndefined();
    }
    for (const resource of [firstActivity, secondActivity]) {
      const snapshot = resource.getSnapshot();
      if (snapshot.status !== "ready") {
        throw new Error("Activity Log did not load");
      }
      expect(snapshot.data.entries[0]).toMatchObject({
        type: "next_action_change",
        content:
          'Completed "Call the clinic" — next move set to "Book appointment"',
        previousValue: "Call the clinic",
        newValue: "Book appointment",
      });
    }

    for (const cleanup of cleanups) cleanup();
  });

  it("connects the public Thread watch to the Convex detail query", () => {
    const detailWatch = new MutableWatch<ConvexProjectedThreadDetail | null>();
    const convex = {
      watchQuery: (reference: unknown, args: unknown) => {
        if (getFunctionName(reference as never) !== "threads:detailBySlug") {
          throw new Error("Wrong Thread detail query");
        }
        if ((args as { slug: string }).slug !== thread.slug) {
          throw new Error("Wrong Thread slug");
        }
        return detailWatch;
      },
      watchPaginatedQuery: () => new MutablePaginatedWatch<ActivityLogEntry>(),
      mutation: async () => ({ status: "unchanged" }),
    } as unknown as ConvexReactClient;
    const client = createConvexApplicationClient(createConvexGateway(convex));
    const resource = client.watchThreadDetail({ slug: thread.slug });
    const unsubscribe = resource.subscribe(() => undefined);

    detailWatch.publish({ thread: convexThread, area: convexArea });

    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { thread, area },
    });
    unsubscribe();
  });

  it("connects the public Activity Log watch to Convex pagination", () => {
    const activityWatch = new MutablePaginatedWatch<ConvexActivityLogEntry>();
    const watchPaginatedQuery = vi.fn(
      (reference: unknown, args: unknown, options: unknown) => {
        expect(getFunctionName(reference as never)).toBe(
          "activityLogs:listByThread",
        );
        expect(args).toEqual({ threadId: convexThread._id });
        expect(options).toEqual({
          initialNumItems: 7,
          id: expect.any(Number),
        });
        return activityWatch;
      },
    );
    const convex = {
      watchQuery: () => new MutableWatch<ConvexProjectedThreadDetail | null>(),
      watchPaginatedQuery,
      mutation: async () => ({ status: "unchanged" }),
    } as unknown as ConvexReactClient;
    const client = createConvexApplicationClient(createConvexGateway(convex));
    const resource = client.watchThreadActivity({
      threadId: thread._id,
      initialPageSize: 7,
    });
    const unsubscribe = resource.subscribe(() => undefined);

    expect(watchPaginatedQuery).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
