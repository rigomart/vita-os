export type ThreadId = string;
export type AreaId = string;

export type Condition = "healthy" | "needs_attention" | "critical";

export type AreaIcon =
  | "Compass"
  | "HeartPulse"
  | "Dumbbell"
  | "Users"
  | "Home"
  | "BriefcaseBusiness"
  | "WalletCards"
  | "BookOpen"
  | "Utensils"
  | "Car"
  | "CalendarDays"
  | "Palette"
  | "Leaf"
  | "Shield"
  | "Plane";

export interface AreaSummary {
  _id: AreaId;
  name: string;
  slug: string;
  standard?: string;
  condition: Condition;
  icon: AreaIcon;
  order: number;
  createdAt: number;
}

export interface Thread {
  _id: ThreadId;
  title: string;
  slug: string;
  summary?: string;
  areaId: AreaId;
  order: number;
  state: "open" | "resolved";
  nextMove?: string;
  upNext?: string[];
  followUp?: number;
  lastActivityAt?: number;
  lastActivityContent?: string;
  createdAt: number;
}

export interface ThreadDetail {
  thread: Thread;
  area: AreaSummary;
}

export type ActivityLogEntryType =
  | "area_move"
  | "next_action_change"
  | "state_change"
  | "follow_up_change";

export interface ActivityLogEntry {
  _id: string;
  type: ActivityLogEntryType;
  content: string;
  previousValue?: string;
  newValue?: string;
  createdAt: number;
}

export interface ApplicationError {
  code:
    | "unauthorized"
    | "not_found"
    | "validation"
    | "conflict"
    | "unavailable"
    | "unexpected";
  message: string;
  retryable: boolean;
}

export type QueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "not_found" }
  | { status: "error"; error: ApplicationError };

export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApplicationError };

export type CompleteNextMoveOutput =
  | { status: "completed" }
  | { status: "unchanged" };

export type ActivityLogPagination =
  | "can_load_more"
  | "loading_more"
  | "exhausted";

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  pagination: ActivityLogPagination;
}

export interface LiveResource<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface PaginatedLiveResource<T> extends LiveResource<T> {
  loadMore: () => void;
}

export interface ApplicationClient {
  watchThreadDetail(input: {
    slug: string;
  }): LiveResource<QueryState<ThreadDetail>>;
  watchThreadActivity(input: {
    threadId: ThreadId;
    initialPageSize: number;
  }): PaginatedLiveResource<QueryState<ActivityLogPage>>;
  completeNextMove(input: {
    threadId: ThreadId;
    thread: Thread;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
