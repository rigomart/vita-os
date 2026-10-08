import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

import {
  ActivityLogPageSchema,
  ApplicationErrorSchema,
  AreaSummarySchema,
  CommandAckSchema,
  NoteAddedToThreadSchema,
  NotePageSchema,
  NoteSchema,
  ThreadDetailSchema,
  ThreadNotePageSchema,
  ThreadNoteSchema,
  ThreadSchema,
} from "@vita-os/contracts";
import * as v from "valibot";

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

const AreaListSchema = v.array(AreaSummarySchema);
const ThreadListSchema = v.array(ThreadSchema);
const NoteListSchema = v.array(NoteSchema);
const ThreadNoteListSchema = v.array(ThreadNoteSchema);
const CountSchema = v.pipe(
  v.object({ count: v.pipe(v.number(), v.safeInteger()) }),
  v.transform(({ count }) => count),
);
const ErrorResponseSchema = v.object({ error: ApplicationErrorSchema });

function parseResponse<T>(
  schema: v.GenericSchema<unknown, T>,
  value: unknown,
): T | undefined {
  const result = v.safeParse(schema, value);
  return result.success ? result.output : undefined;
}

/**
 * The status the service answered with decides the error's code, so a caller's
 * handling of "not found" or "unauthorized" never depends on a message.
 */
function statusErrorCode(status: number): ApplicationError["code"] | undefined {
  switch (status) {
    case 400:
    case 415:
      return "validation";
    case 401:
    case 403:
      return "unauthorized";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 502:
    case 503:
    case 504:
      return "unavailable";
    default:
      return undefined;
  }
}

async function readJson(response: Response): Promise<unknown> {
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
  successSchema: v.GenericSchema<unknown, T>;
}): Promise<OperationResult<T>> {
  let response: Response;
  try {
    // Call fetch detached: invoked as `input.fetchImpl(...)`, the browser's
    // fetch receives `input` as `this` and throws "Illegal invocation".
    const fetchImpl = input.fetchImpl;
    response = await fetchImpl(input.url, input.init);
  } catch {
    // A request that never reached the service is worth retrying; nothing is
    // known about whether it was applied, so callers treat it as unavailable.
    return { ok: false, error: unavailable };
  }

  const body = await readJson(response);
  if (response.ok) {
    const value = parseResponse(input.successSchema, body);
    return value === undefined
      ? { ok: false, error: unexpectedResponse }
      : { ok: true, value };
  }

  const error = parseResponse(ErrorResponseSchema, body)?.error;
  if (error === undefined) return { ok: false, error: unexpectedResponse };

  const code = statusErrorCode(response.status);
  if (code === undefined) return { ok: false, error };
  return {
    ok: false,
    error: { code, message: error.message, retryable: code === "unavailable" },
  };
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

/**
 * The browser's implementation of the application contract.
 *
 * Every request carries credentials, and every response is validated before it
 * becomes a Vita OS value. Nothing here caches, retries, or holds loading state:
 * that belongs to the shared React application.
 */
export function createHttpApplicationClient({
  apiBaseUrl,
  fetchImpl = fetch,
}: HttpApplicationClientOptions): ApplicationClient {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const path = (...segments: string[]) =>
    `${baseUrl}/v1/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const literalPath = (path_: string) => `${baseUrl}/v1/${path_}`;

  const read = <T>(url: string, successSchema: v.GenericSchema<unknown, T>) =>
    request({
      fetchImpl,
      url,
      init: { method: "GET", credentials: "include" },
      successSchema,
    });

  const send = <T>(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    body: unknown,
    successSchema: v.GenericSchema<unknown, T>,
  ) =>
    request({
      fetchImpl,
      url,
      init: {
        method,
        credentials: "include",
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
      successSchema,
    });

  const pageQuery = (input: { limit: number; cursor?: string }) => {
    const query = new URLSearchParams({ limit: input.limit.toString() });
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    return query.toString();
  };

  return {
    /* Areas */
    listAreas: () => read(literalPath("areas"), AreaListSchema),
    createArea: (input) =>
      send("POST", literalPath("areas"), input, AreaSummarySchema),
    updateArea: ({ areaId, ...change }) =>
      send("PATCH", path("areas", areaId), change, AreaSummarySchema),
    reorderAreas: (input) =>
      send("PUT", literalPath("areas/order"), input, AreaListSchema),
    removeArea: (input) =>
      send("DELETE", path("areas", input.areaId), undefined, CommandAckSchema),

    /* Threads */
    listOpenThreads: () => read(literalPath("threads"), ThreadListSchema),
    listResolvedThreads: () =>
      read(literalPath("threads/resolved"), ThreadListSchema),
    getThreadDetail: (input) =>
      read(path("threads", input.slug), ThreadDetailSchema),
    createThread: (input) =>
      send("POST", literalPath("threads"), input, ThreadSchema),
    updateThread: ({ threadId, ...change }) =>
      send("PATCH", path("threads", threadId), change, ThreadSchema),
    removeThread: (input) =>
      send(
        "DELETE",
        path("threads", input.threadId),
        undefined,
        CommandAckSchema,
      ),

    /* Tasks */
    addTask: ({ threadId, ...task }) =>
      send("POST", path("threads", threadId, "tasks"), task, ThreadSchema),
    editTask: ({ threadId, taskId, ...change }) =>
      send(
        "PATCH",
        path("threads", threadId, "tasks", taskId),
        change,
        ThreadSchema,
      ),
    removeTask: ({ threadId, taskId }) =>
      send(
        "DELETE",
        path("threads", threadId, "tasks", taskId),
        undefined,
        ThreadSchema,
      ),
    completeTask: ({ threadId, taskId, expectedOccurrence, timeZone, note }) =>
      send(
        "POST",
        path("threads", threadId, "tasks", taskId, "complete"),
        {
          expectedOccurrence,
          ...(timeZone === undefined ? {} : { timeZone }),
          ...(note === undefined
            ? {}
            : { note: { id: note.id, body: note.body } }),
        },
        ThreadSchema,
      ),
    setTaskDate: ({ threadId, taskId, ...change }) =>
      send(
        "PUT",
        path("threads", threadId, "tasks", taskId, "date"),
        change,
        ThreadSchema,
      ),
    setTaskRepeat: ({ threadId, taskId, ...change }) =>
      send(
        "PUT",
        path("threads", threadId, "tasks", taskId, "repeat"),
        change,
        ThreadSchema,
      ),
    skipTask: ({ threadId, taskId, ...change }) =>
      send(
        "POST",
        path("threads", threadId, "tasks", taskId, "skip"),
        change,
        ThreadSchema,
      ),
    focusTask: ({ threadId, ...focus }) =>
      send("PUT", path("threads", threadId, "focus"), focus, ThreadSchema),

    /* Activity Log */
    getThreadActivityPage: ({ threadId, ...page }) =>
      read(
        `${path("threads", threadId)}/activity?${pageQuery(page)}`,
        ActivityLogPageSchema,
      ),

    /* Standalone Notes */
    listOpenNotes: () => read(literalPath("notes"), NoteListSchema),
    getDoneNotePage: ({ query, ...page }) => {
      const params = new URLSearchParams(pageQuery(page));
      if (query?.trim()) params.set("q", query);
      return read(literalPath(`notes/done?${params}`), NotePageSchema);
    },
    countOpenNotes: () => read(literalPath("notes/open-count"), CountSchema),
    createNote: (input) =>
      send("POST", literalPath("notes"), input, NoteSchema),
    updateNoteBody: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/body`,
        { body: input.body },
        NoteSchema,
      ),
    updateNoteFollowUp: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/follow-up`,
        { followUp: input.followUp },
        NoteSchema,
      ),
    markNoteDone: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/state`,
        { state: "done" },
        NoteSchema,
      ),
    markNoteOpen: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/state`,
        { state: "open" },
        NoteSchema,
      ),
    removeNote: (input) =>
      send("DELETE", path("notes", input.noteId), undefined, CommandAckSchema),
    addNoteToThread: (input) =>
      send(
        "POST",
        `${path("notes", input.noteId)}/add-to-thread`,
        {
          threadId: input.threadId,
          ...(input.taskId === undefined ? {} : { taskId: input.taskId }),
        },
        NoteAddedToThreadSchema,
      ),
    createThreadFromNote: ({ noteId, ...thread }) =>
      send(
        "POST",
        `${path("notes", noteId)}/new-thread`,
        thread,
        NoteAddedToThreadSchema,
      ),

    /* Thread Notes */
    listOpenThreadNotes: (input) =>
      read(`${path("threads", input.threadId)}/notes`, ThreadNoteListSchema),
    getDoneThreadNotePage: ({ threadId, ...page }) =>
      read(
        `${path("threads", threadId)}/notes/done?${pageQuery(page)}`,
        ThreadNotePageSchema,
      ),
    createThreadNote: (input) =>
      send(
        "POST",
        `${path("threads", input.threadId)}/notes`,
        { body: input.body },
        ThreadNoteSchema,
      ),
    updateThreadNoteBody: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/body`,
        { body: input.body },
        ThreadNoteSchema,
      ),
    markThreadNoteDone: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/state`,
        { state: "done" },
        ThreadNoteSchema,
      ),
    markThreadNoteOpen: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/state`,
        { state: "open" },
        ThreadNoteSchema,
      ),
    removeThreadNote: (input) =>
      send(
        "DELETE",
        path("thread-notes", input.threadNoteId),
        undefined,
        CommandAckSchema,
      ),
  };
}
