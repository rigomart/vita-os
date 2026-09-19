import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type {
  ActivityLogEntry,
  ApplicationError,
  AreaId,
  CompleteNextMoveOutput,
  AreaSummary,
  OperationResult,
  Thread,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";
import type { OptimisticLocalStore } from "convex/browser";
import type { ConvexReactClient } from "convex/react";

import { api } from "@convex/_generated/api";

import { optimisticallyCompleteNextMove } from "@/features/threads/optimistic";

import type {
  ConvexActivityLogPage,
  ConvexApplicationClient,
  ConvexLiveResource,
  ConvexPaginatedLiveResource,
  ConvexQueryState,
} from "./convex-application-client-compatibility";

import {
  createConvexLiveResource,
  type ConvexWatch,
} from "./convex-live-resource";

export type { ConvexWatch } from "./convex-live-resource";

type ConvexPaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

interface ConvexPaginatedResult<T> {
  results: T[];
  status: ConvexPaginationStatus;
  loadMore: (pageSize: number) => boolean;
}

export interface ConvexPaginatedWatch<T> extends ConvexWatch<
  ConvexPaginatedResult<T>
> {}

export interface ConvexActivityLogEntry {
  _id: string;
  type:
    | "note"
    | "area_move"
    | "next_action_change"
    | "state_change"
    | "follow_up_change";
  content: string;
  previousValue?: string;
  newValue?: string;
  createdAt: number;
}

type ConvexCompleteNextMoveInput = { id: Id<"threads"> };
type ConvexCompletionOptimisticUpdate = (
  localStore: OptimisticLocalStore,
  input: ConvexCompleteNextMoveInput,
) => void;

export interface ConvexCompletionGateway {
  completeNextMove(
    input: ConvexCompleteNextMoveInput,
    optimisticUpdate: ConvexCompletionOptimisticUpdate,
  ): Promise<CompleteNextMoveOutput>;
}

export interface ConvexApplicationGateway extends ConvexCompletionGateway {
  watchThreadDetail(input: {
    slug: string;
  }): ConvexWatch<ConvexThreadDetail | null>;
  watchThreadActivity(input: {
    threadId: ThreadId;
    initialPageSize: number;
  }): ConvexPaginatedWatch<ConvexActivityLogEntry>;
}

export interface ConvexThreadDetail {
  thread: ProjectedThread;
  area: ProjectedArea | null;
}

function toThread(thread: ProjectedThread): Thread {
  return {
    ...thread,
    _id: thread._id as unknown as ThreadId,
    areaId: thread.areaId as unknown as AreaId,
  };
}

function toAreaSummary(area: ProjectedArea): AreaSummary {
  return { ...area, _id: area._id as unknown as AreaId };
}

export function toApplicationError(error: unknown): ApplicationError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("unauthenticated") || message.includes("unauthorized")) {
    return {
      code: "unauthorized",
      message: "You are not authorized to access this Thread.",
      retryable: false,
    };
  }
  if (message.includes("not found")) {
    return {
      code: "not_found",
      message: "Thread not found.",
      retryable: false,
    };
  }
  if (
    message.includes("websocket") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("disconnect")
  ) {
    return {
      code: "unavailable",
      message: "The service is temporarily unavailable.",
      retryable: true,
    };
  }

  return {
    code: "unexpected",
    message: "Something went wrong.",
    retryable: false,
  };
}

const LOADING_THREAD_DETAIL = { status: "loading" } as const;
const THREAD_NOT_FOUND = { status: "not_found" } as const;
const LOADING_THREAD_ACTIVITY = { status: "loading" } as const;

export function createThreadDetailResource(
  createWatch: () => ConvexWatch<ConvexThreadDetail | null>,
): ConvexLiveResource<ConvexQueryState<ThreadDetail>> {
  return createConvexLiveResource({
    createWatch,
    initialSnapshot: LOADING_THREAD_DETAIL,
    readSnapshot: (detail): ConvexQueryState<ThreadDetail> => {
      if (detail === undefined) return LOADING_THREAD_DETAIL;
      if (detail === null || detail.area === null) return THREAD_NOT_FOUND;
      return {
        status: "ready",
        data: {
          thread: toThread(detail.thread),
          area: toAreaSummary(detail.area),
        },
      };
    },
    readError: (error) => ({
      status: "error",
      error: toApplicationError(error),
    }),
  });
}

export function createThreadActivityResource(
  createWatch: () => ConvexPaginatedWatch<ConvexActivityLogEntry>,
  pageSize: number,
): ConvexPaginatedLiveResource<ConvexQueryState<ConvexActivityLogPage>> {
  let loadMore: ((pageSize: number) => boolean) | undefined;
  const resource = createConvexLiveResource<
    ConvexPaginatedResult<ConvexActivityLogEntry>,
    ConvexQueryState<ConvexActivityLogPage>
  >({
    createWatch,
    initialSnapshot: LOADING_THREAD_ACTIVITY,
    readSnapshot: (result): ConvexQueryState<ConvexActivityLogPage> => {
      if (result === undefined || result.status === "LoadingFirstPage") {
        return LOADING_THREAD_ACTIVITY;
      }

      loadMore = result.loadMore;
      const entries = result.results.filter(
        (entry): entry is ActivityLogEntry => entry.type !== "note",
      );
      return {
        status: "ready",
        data: {
          entries,
          pagination:
            result.status === "CanLoadMore"
              ? "can_load_more"
              : result.status === "LoadingMore"
                ? "loading_more"
                : "exhausted",
        },
      };
    },
    readError: (error) => ({
      status: "error",
      error: toApplicationError(error),
    }),
  });

  return {
    ...resource,
    loadMore: () => {
      const snapshot = resource.getSnapshot();
      if (
        snapshot.status === "ready" &&
        snapshot.data.pagination === "can_load_more"
      ) {
        loadMore?.(pageSize);
      }
    },
  };
}

export async function completeNextMoveThroughConvex(
  gateway: ConvexCompletionGateway,
  input: { threadId: ThreadId; thread: Thread },
): Promise<OperationResult<CompleteNextMoveOutput>> {
  try {
    const value = await gateway.completeNextMove(
      { id: input.threadId as unknown as Id<"threads"> },
      (localStore, args) => {
        optimisticallyCompleteNextMove(localStore, args, {
          thread: input.thread as unknown as ProjectedThread,
        });
      },
    );
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: toApplicationError(error) };
  }
}

export function createConvexApplicationClient(
  gateway: ConvexApplicationGateway,
): ConvexApplicationClient {
  return {
    watchThreadDetail: (input) =>
      createThreadDetailResource(() => gateway.watchThreadDetail(input)),
    watchThreadActivity: (input) =>
      createThreadActivityResource(
        () => gateway.watchThreadActivity(input),
        input.initialPageSize,
      ),
    completeNextMove: (input) => completeNextMoveThroughConvex(gateway, input),
  };
}

let paginationId = 0;

interface ConvexClientWithPaginatedWatch {
  watchPaginatedQuery(
    query: typeof api.activityLogs.listByThread,
    args: { threadId: Id<"threads"> },
    options: { initialNumItems: number; id: number },
  ): ConvexPaginatedWatch<ConvexActivityLogEntry>;
}

export function createConvexGateway(
  convex: ConvexReactClient,
): ConvexApplicationGateway {
  return {
    watchThreadDetail: ({ slug }) =>
      convex.watchQuery(api.threads.detailBySlug, { slug }),
    watchThreadActivity: ({ threadId, initialPageSize }) =>
      (convex as unknown as ConvexClientWithPaginatedWatch).watchPaginatedQuery(
        api.activityLogs.listByThread,
        { threadId: threadId as unknown as Id<"threads"> },
        { initialNumItems: initialPageSize, id: paginationId++ },
      ),
    completeNextMove: (input, optimisticUpdate) =>
      convex.mutation(api.threads.completeNextMoveMutation, input, {
        optimisticUpdate,
      }),
  };
}
