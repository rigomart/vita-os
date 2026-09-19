import type {
  ActivityLogEntry,
  ApplicationError,
  CompleteNextMoveOutput,
  OperationResult,
  Thread,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";

export type ConvexQueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "not_found" }
  | { status: "error"; error: ApplicationError };

export interface ConvexActivityLogPage {
  entries: ActivityLogEntry[];
  pagination: "can_load_more" | "loading_more" | "exhausted";
}

export interface ConvexLiveResource<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface ConvexPaginatedLiveResource<T> extends ConvexLiveResource<T> {
  loadMore: () => void;
}

export interface ConvexApplicationClient {
  watchThreadDetail(input: {
    slug: string;
  }): ConvexLiveResource<ConvexQueryState<ThreadDetail>>;
  watchThreadActivity(input: {
    threadId: ThreadId;
    initialPageSize: number;
  }): ConvexPaginatedLiveResource<ConvexQueryState<ConvexActivityLogPage>>;
  completeNextMove(input: {
    threadId: ThreadId;
    thread: Thread;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
