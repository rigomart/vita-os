declare const threadIdBrand: unique symbol;
declare const areaIdBrand: unique symbol;

export type ThreadId = string & { readonly [threadIdBrand]: "ThreadId" };
export type AreaId = string & { readonly [areaIdBrand]: "AreaId" };

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

export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApplicationError };

export type CompleteNextMoveOutput =
  | { status: "completed" }
  | { status: "unchanged" };

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  nextCursor?: string;
}

export interface ApplicationClient {
  getThreadDetail(input: {
    slug: string;
  }): Promise<OperationResult<ThreadDetail>>;
  getThreadActivityPage(input: {
    threadId: ThreadId;
    limit: number;
    cursor?: string;
  }): Promise<OperationResult<ActivityLogPage>>;
  completeNextMove(input: {
    threadId: ThreadId;
    expectedNextMove: string | null;
  }): Promise<OperationResult<CompleteNextMoveOutput>>;
}
