import type {
  ActivityLogEntry,
  ActivityLogPage,
  ApplicationClient,
  ApplicationError,
  AreaIcon,
  AreaId,
  AreaSummary,
  CompleteNextMoveOutput,
  Condition,
  OperationResult,
  ThreadDetail,
  ThreadId,
  VersionedThread,
} from "@vita-os/contracts";

type JsonObject = Record<string, unknown>;
type BrowserRequestInit = RequestInit & {
  credentials?: "include" | "omit" | "same-origin";
};
type FetchImplementation = (
  input: string | URL | Request,
  init?: BrowserRequestInit,
) => Promise<Response>;

export interface HttpApplicationClientOptions {
  apiBaseUrl: string;
  fetchImpl?: FetchImplementation;
}

const unexpectedResponse: ApplicationError = {
  code: "unexpected",
  message: "Unexpected response from the service.",
  retryable: false,
};

const unavailable: ApplicationError = {
  code: "unavailable",
  message: "The service is temporarily unavailable.",
  retryable: true,
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThreadId(value: unknown): value is ThreadId {
  return typeof value === "string";
}

function isAreaId(value: unknown): value is AreaId {
  return typeof value === "string";
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalSafeInteger(value: unknown): value is number | undefined {
  return value === undefined || isSafeInteger(value);
}

function isCondition(value: unknown): value is Condition {
  return (
    value === "healthy" || value === "needs_attention" || value === "critical"
  );
}

function isAreaIcon(value: unknown): value is AreaIcon {
  switch (value) {
    case "Compass":
    case "HeartPulse":
    case "Dumbbell":
    case "Users":
    case "Home":
    case "BriefcaseBusiness":
    case "WalletCards":
    case "BookOpen":
    case "Utensils":
    case "Car":
    case "CalendarDays":
    case "Palette":
    case "Leaf":
    case "Shield":
    case "Plane":
      return true;
    default:
      return false;
  }
}

function isThreadState(value: unknown): value is VersionedThread["state"] {
  return value === "open" || value === "resolved";
}

function isActivityLogEntryType(
  value: unknown,
): value is ActivityLogEntry["type"] {
  return (
    value === "area_move" ||
    value === "next_action_change" ||
    value === "state_change" ||
    value === "follow_up_change"
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function decodeThread(value: unknown): VersionedThread | undefined {
  if (!isObject(value)) return undefined;

  const {
    _id,
    title,
    slug,
    summary,
    areaId,
    order,
    state,
    nextMove,
    upNext,
    followUp,
    lastActivityAt,
    lastActivityContent,
    revision,
    createdAt,
  } = value;
  if (
    !isThreadId(_id) ||
    typeof title !== "string" ||
    typeof slug !== "string" ||
    !isOptionalString(summary) ||
    !isAreaId(areaId) ||
    !isSafeInteger(order) ||
    !isThreadState(state) ||
    !isOptionalString(nextMove) ||
    (upNext !== undefined && !isStringArray(upNext)) ||
    !isOptionalSafeInteger(followUp) ||
    !isOptionalSafeInteger(lastActivityAt) ||
    !isOptionalString(lastActivityContent) ||
    !isSafeInteger(revision) ||
    revision < 0 ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id,
    title,
    slug,
    ...(summary === undefined ? {} : { summary }),
    areaId,
    order,
    state,
    ...(nextMove === undefined ? {} : { nextMove }),
    ...(upNext === undefined ? {} : { upNext }),
    ...(followUp === undefined ? {} : { followUp }),
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    ...(lastActivityContent === undefined ? {} : { lastActivityContent }),
    revision,
    createdAt,
  };
}

function decodeAreaSummary(value: unknown): AreaSummary | undefined {
  if (!isObject(value)) return undefined;

  const { _id, name, slug, standard, condition, icon, order, createdAt } =
    value;
  if (
    !isAreaId(_id) ||
    typeof name !== "string" ||
    typeof slug !== "string" ||
    !isOptionalString(standard) ||
    !isCondition(condition) ||
    !isAreaIcon(icon) ||
    !isSafeInteger(order) ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id,
    name,
    slug,
    ...(standard === undefined ? {} : { standard }),
    condition,
    icon,
    order,
    createdAt,
  };
}

function decodeThreadDetail(value: unknown): ThreadDetail | undefined {
  if (!isObject(value)) return undefined;

  const thread = decodeThread(value.thread);
  const area = decodeAreaSummary(value.area);
  if (thread === undefined || area === undefined) return undefined;

  return { thread, area };
}

function decodeActivityLogEntry(value: unknown): ActivityLogEntry | undefined {
  if (!isObject(value)) return undefined;

  const { _id, type, content, previousValue, newValue, createdAt } = value;
  if (
    typeof _id !== "string" ||
    !isActivityLogEntryType(type) ||
    typeof content !== "string" ||
    !isOptionalString(previousValue) ||
    !isOptionalString(newValue) ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id,
    type,
    content,
    ...(previousValue === undefined ? {} : { previousValue }),
    ...(newValue === undefined ? {} : { newValue }),
    createdAt,
  };
}

function decodeActivityLogPage(value: unknown): ActivityLogPage | undefined {
  if (!isObject(value) || !Array.isArray(value.entries)) return undefined;

  const entries = value.entries.map(decodeActivityLogEntry);
  if (entries.some((entry) => entry === undefined)) return undefined;
  if (!isOptionalString(value.nextCursor)) return undefined;

  return {
    entries: entries.filter(
      (entry): entry is ActivityLogEntry => entry !== undefined,
    ),
    ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
  };
}

function decodeCompletion(value: unknown): CompleteNextMoveOutput | undefined {
  if (!isObject(value)) return undefined;
  if (value.status === "completed") return { status: "completed" };
  if (value.status === "unchanged") return { status: "unchanged" };
  return undefined;
}

function decodeApplicationError(value: unknown): ApplicationError | undefined {
  if (!isObject(value) || !isObject(value.error)) return undefined;

  const { code, message, retryable } = value.error;
  if (
    (code !== "unauthorized" &&
      code !== "not_found" &&
      code !== "validation" &&
      code !== "conflict" &&
      code !== "unavailable" &&
      code !== "unexpected") ||
    typeof message !== "string" ||
    typeof retryable !== "boolean"
  ) {
    return undefined;
  }

  return { code, message, retryable };
}

function statusErrorCode(status: number): ApplicationError["code"] | undefined {
  switch (status) {
    case 400:
      return "validation";
    case 401:
    case 403:
      return "unauthorized";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 415:
      return "validation";
    case 502:
    case 503:
    case 504:
      return "unavailable";
    default:
      return undefined;
  }
}

async function readJson(response: Response): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(input: {
  fetchImpl: FetchImplementation;
  url: string;
  init: BrowserRequestInit;
  decodeSuccess: (value: unknown) => T | undefined;
}): Promise<OperationResult<T>> {
  let response: Response;
  try {
    response = await input.fetchImpl(input.url, input.init);
  } catch {
    return { ok: false, error: unavailable };
  }

  const body = await readJson(response);
  if (response.ok) {
    const value = input.decodeSuccess(body);
    return value === undefined
      ? { ok: false, error: unexpectedResponse }
      : { ok: true, value };
  }

  const error = decodeApplicationError(body);
  if (error === undefined) return { ok: false, error: unexpectedResponse };

  const code = statusErrorCode(response.status);
  if (code === undefined) return { ok: false, error };
  return {
    ok: false,
    error: {
      code,
      message: error.message,
      retryable: code === "unavailable",
    },
  };
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function threadUrl(apiBaseUrl: string, segment: string): string {
  return `${apiBaseUrl}/v1/threads/${encodeURIComponent(segment)}`;
}

export function createHttpApplicationClient({
  apiBaseUrl,
  fetchImpl = fetch,
}: HttpApplicationClientOptions): ApplicationClient {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);

  return {
    getThreadDetail: (input) =>
      request({
        fetchImpl,
        url: threadUrl(baseUrl, input.slug),
        init: { method: "GET", credentials: "include" },
        decodeSuccess: decodeThreadDetail,
      }),
    getThreadActivityPage: (input) => {
      const query = new URLSearchParams({ limit: input.limit.toString() });
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      return request({
        fetchImpl,
        url: `${threadUrl(baseUrl, input.threadId)}/activity?${query}`,
        init: { method: "GET", credentials: "include" },
        decodeSuccess: decodeActivityLogPage,
      });
    },
    completeNextMove: (input) =>
      request({
        fetchImpl,
        url: `${threadUrl(baseUrl, input.threadId)}/complete-next-move`,
        init: {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedNextMove: input.expectedNextMove,
            expectedRevision: input.expectedRevision,
          }),
        },
        decodeSuccess: decodeCompletion,
      }),
  };
}
