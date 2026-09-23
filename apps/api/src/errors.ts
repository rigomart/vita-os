import type { ApplicationError } from "@vita-os/contracts";

/**
 * The stable errors the Worker answers with.
 *
 * A missing record and a record owned by somebody else produce the same status,
 * body, and message, so a caller cannot use the difference to discover that
 * somebody else's record exists.
 */

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

export const requestOriginNotAllowed: ApplicationError = {
  code: "unauthorized",
  message: "Request origin is not allowed.",
  retryable: false,
};

export const jsonRequestRequired: ApplicationError = {
  code: "validation",
  message: "JSON request body required.",
  retryable: false,
};

export const areaNotFound: ApplicationError = {
  code: "not_found",
  message: "Area not found.",
  retryable: false,
};

export const threadNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread not found.",
  retryable: false,
};

export const noteNotFound: ApplicationError = {
  code: "not_found",
  message: "Note not found.",
  retryable: false,
};

export const threadNoteNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread note not found.",
  retryable: false,
};

export const invalidPagination: ApplicationError = {
  code: "validation",
  message: "Invalid pagination.",
  retryable: false,
};

/** Kept for the Activity Log's own wording, which callers already recognize. */
export const invalidActivityPagination: ApplicationError = {
  code: "validation",
  message: "Invalid Activity Log pagination.",
  retryable: false,
};

export const invalidNextMoveCompletion: ApplicationError = {
  code: "validation",
  message: "Invalid Next Move completion.",
  retryable: false,
};

export const nextMoveConflict: ApplicationError = {
  code: "conflict",
  message: "Next Move has changed.",
  retryable: false,
};

export const changeConflict: ApplicationError = {
  code: "conflict",
  message: "The record changed while this request was in flight.",
  retryable: true,
};

export const unexpectedFailure: ApplicationError = {
  code: "unexpected",
  message: "Unexpected error.",
  retryable: false,
};

/** A refused input, carrying the rule's own words for the person who typed it. */
export function invalidRequest(message: string): ApplicationError {
  return { code: "validation", message, retryable: false };
}

/** A refused write, because of the state the record is in. */
export function refusedByState(message: string): ApplicationError {
  return { code: "conflict", message, retryable: false };
}
