import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

import {
  decodeAcknowledgement,
  decodeActivityLogPage,
  decodeAreaDetail,
  decodeAreaList,
  decodeAreaSummary,
  decodeCompletion,
  decodeCount,
  decodeNote,
  decodeNoteList,
  decodeNotePage,
  decodeThread,
  decodeThreadDetail,
  decodeThreadList,
  decodeThreadNote,
  decodeThreadNoteList,
  decodeThreadNotePage,
  isObject,
} from "./decode";

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
  decodeSuccess: (value: unknown) => T | undefined;
}): Promise<OperationResult<T>> {
  let response: Response;
  try {
    response = await input.fetchImpl(input.url, input.init);
  } catch {
    // A request that never reached the service is worth retrying; nothing is
    // known about whether it was applied, so callers treat it as unavailable.
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

  const read = <T>(
    url: string,
    decodeSuccess: (value: unknown) => T | undefined,
  ) =>
    request({
      fetchImpl,
      url,
      init: { method: "GET", credentials: "include" },
      decodeSuccess,
    });

  const send = <T>(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    body: unknown,
    decodeSuccess: (value: unknown) => T | undefined,
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
      decodeSuccess,
    });

  const pageQuery = (input: { limit: number; cursor?: string }) => {
    const query = new URLSearchParams({ limit: input.limit.toString() });
    if (input.cursor !== undefined) query.set("cursor", input.cursor);
    return query.toString();
  };

  return {
    /* Areas */
    listAreas: () => read(literalPath("areas"), decodeAreaList),
    getAreaDetail: (input) => read(path("areas", input.slug), decodeAreaDetail),
    createArea: (input) =>
      send("POST", literalPath("areas"), input, decodeAreaSummary),
    updateArea: ({ areaId, ...change }) =>
      send("PATCH", path("areas", areaId), change, decodeAreaSummary),
    removeArea: (input) =>
      send(
        "DELETE",
        path("areas", input.areaId),
        undefined,
        decodeAcknowledgement,
      ),

    /* Threads */
    listOpenThreads: () => read(literalPath("threads"), decodeThreadList),
    getThreadDetail: (input) =>
      read(path("threads", input.slug), decodeThreadDetail),
    createThread: (input) =>
      send("POST", literalPath("threads"), input, decodeThread),
    updateThread: ({ threadId, ...change }) =>
      send("PATCH", path("threads", threadId), change, decodeThread),
    removeThread: (input) =>
      send(
        "DELETE",
        path("threads", input.threadId),
        undefined,
        decodeAcknowledgement,
      ),
    replaceUpNext: (input) =>
      send(
        "PUT",
        `${path("threads", input.threadId)}/up-next`,
        { moves: input.moves },
        decodeThread,
      ),
    completeNextMove: ({ threadId, ...expectation }) =>
      send(
        "POST",
        `${path("threads", threadId)}/complete-next-move`,
        expectation,
        decodeCompletion,
      ),

    /* Activity Log */
    getThreadActivityPage: ({ threadId, ...page }) =>
      read(
        `${path("threads", threadId)}/activity?${pageQuery(page)}`,
        decodeActivityLogPage,
      ),

    /* Standalone Notes */
    listOpenNotes: () => read(literalPath("notes"), decodeNoteList),
    getDoneNotePage: (input) =>
      read(literalPath(`notes/done?${pageQuery(input)}`), decodeNotePage),
    countOpenNotes: () => read(literalPath("notes/open-count"), decodeCount),
    createNote: (input) =>
      send("POST", literalPath("notes"), input, decodeNote),
    updateNoteBody: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/body`,
        { body: input.body },
        decodeNote,
      ),
    updateNoteAttentionDate: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/attention-date`,
        { when: input.when },
        decodeNote,
      ),
    markNoteDone: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/state`,
        { state: "done" },
        decodeNote,
      ),
    markNoteOpen: (input) =>
      send(
        "PATCH",
        `${path("notes", input.noteId)}/state`,
        { state: "open" },
        decodeNote,
      ),
    removeNote: (input) =>
      send(
        "DELETE",
        path("notes", input.noteId),
        undefined,
        decodeAcknowledgement,
      ),

    /* Thread Notes */
    listOpenThreadNotes: (input) =>
      read(`${path("threads", input.threadId)}/notes`, decodeThreadNoteList),
    getDoneThreadNotePage: ({ threadId, ...page }) =>
      read(
        `${path("threads", threadId)}/notes/done?${pageQuery(page)}`,
        decodeThreadNotePage,
      ),
    createThreadNote: (input) =>
      send(
        "POST",
        `${path("threads", input.threadId)}/notes`,
        { body: input.body },
        decodeThreadNote,
      ),
    updateThreadNoteBody: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/body`,
        { body: input.body },
        decodeThreadNote,
      ),
    markThreadNoteDone: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/state`,
        { state: "done" },
        decodeThreadNote,
      ),
    markThreadNoteOpen: (input) =>
      send(
        "PATCH",
        `${path("thread-notes", input.threadNoteId)}/state`,
        { state: "open" },
        decodeThreadNote,
      ),
    removeThreadNote: (input) =>
      send(
        "DELETE",
        path("thread-notes", input.threadNoteId),
        undefined,
        decodeAcknowledgement,
      ),
  };
}
