import type { Id } from "@convex/_generated/dataModel";
import type { ActivityLogEntry, AreaSummary, Thread } from "@vita-os/contracts";
import type { ConvexReactClient } from "convex/react";

import { api } from "@convex/_generated/api";
import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import type {
  ConvexApplicationGateway,
  ConvexPaginatedWatch,
  ConvexCompletionGateway,
  ConvexThreadDetail,
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
  _id: "area1",
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "needs_attention",
  order: 0,
  createdAt: 1,
} satisfies AreaSummary;

const thread = {
  _id: "thread1",
  title: "Book checkup",
  slug: "book-checkup",
  areaId: area._id,
  order: 0,
  state: "open",
  nextMove: "Call clinic",
  upNext: ["Book appointment"],
  createdAt: 2,
} satisfies Thread;

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
    const watch = new MutableWatch<ConvexThreadDetail | null>();
    const resource = createThreadDetailResource(() => watch);
    const onChange = vi.fn();

    expect(resource.getSnapshot()).toEqual({ status: "loading" });

    const unsubscribe = resource.subscribe(onChange);
    watch.publish({ thread, area });

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
    const watch = new MutableWatch<ConvexThreadDetail | null>();
    const resource = createThreadDetailResource(() => watch);
    const unsubscribe = resource.subscribe(() => undefined);

    watch.publish(null);

    expect(resource.getSnapshot()).toEqual({ status: "not_found" });
    unsubscribe();
  });

  it("represents a failed subscription with a transport-neutral error", () => {
    const watch = new MutableWatch<ConvexThreadDetail | null>();
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
    const convexThread = {
      ...thread,
      _id: thread._id as Id<"threads">,
      areaId: thread.areaId as Id<"areas">,
    };
    const convexArea = {
      ...area,
      _id: area._id as Id<"areas">,
    };
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
    const gateway: ConvexCompletionGateway = {
      completeNextMove: async (input, optimisticUpdate) => {
        optimisticUpdate(localStore.store, input);
        return { status: "completed" };
      },
    };

    const outcome = await completeNextMoveThroughConvex(gateway, {
      threadId: thread._id,
      thread,
    });

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
    const detailWatch = new MutableWatch<ConvexThreadDetail | null>();
    const activityWatch = new MutablePaginatedWatch<ActivityLogEntry>();
    const gateway: ConvexApplicationGateway = {
      watchThreadDetail: () => detailWatch,
      watchThreadActivity: () => activityWatch,
      completeNextMove: async () => ({ status: "unchanged" }),
    };
    const client = createConvexApplicationClient(gateway);
    const resource = client.watchThreadDetail({ slug: thread.slug });
    const unsubscribe = resource.subscribe(() => undefined);

    detailWatch.publish({ thread, area });

    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { thread, area },
    });
    unsubscribe();
  });

  it("connects the public Thread watch to the Convex detail query", () => {
    const detailWatch = new MutableWatch<ConvexThreadDetail | null>();
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

    detailWatch.publish({ thread, area });

    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      data: { thread, area },
    });
    unsubscribe();
  });
});
