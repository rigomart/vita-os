import type {
  ActivityLogEntry,
  ApplicationError,
  AreaSummary,
  CompleteNextMoveOutput,
  OperationResult,
  Thread,
  ThreadId,
} from "@vita-os/contracts";

export interface ConvexThreadDetail {
  thread: Thread;
  area: AreaSummary;
}

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
  }): ConvexLiveResource<ConvexQueryState<ConvexThreadDetail>>;
  watchThreadActivity(input: {
    threadId: ThreadId;
    initialPageSize: number;
  }): ConvexPaginatedLiveResource<ConvexQueryState<ConvexActivityLogPage>>;
  completeNextMove(input: {
    threadId: ThreadId;
    thread: Thread;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
