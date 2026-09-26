import type { ApplicationError } from "@vita-os/contracts";
import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { ConflictError, ValidationError } from "@vita-os/core";

import { InvalidPageCursorError } from "../d1/page-cursor";

/**
 * The one way a failure becomes a response.
 *
 * Every refusal — an unreadable request, an operation's failed result, a domain
 * rule that threw, an edited cursor — reaches `handleError`, and its status
 * comes from its code. A missing record and a record owned by somebody else
 * produce the same status, body, and message, so a caller cannot use the
 * difference to discover that somebody else's record exists.
 */

const STATUS_BY_CODE: Record<ApplicationError["code"], ContentfulStatusCode> = {
  unauthorized: 401,
  not_found: 404,
  validation: 400,
  conflict: 409,
  unavailable: 503,
  unexpected: 500,
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

/**
 * A request this Worker will not answer with a value.
 *
 * The status is the code's own unless the refusal is about the transport
 * rather than the operation — a forbidden origin or a body that is not JSON.
 */
export class RequestRefusal extends Error {
  constructor(
    readonly error: ApplicationError,
    readonly status: ContentfulStatusCode = STATUS_BY_CODE[error.code],
  ) {
    super(error.message);
    this.name = "RequestRefusal";
  }
}

export function refuse(
  error: ApplicationError,
  status?: ContentfulStatusCode,
): never {
  throw new RequestRefusal(error, status);
}

/** A rule that refuses says why in its own words; anything else says nothing. */
function toRefusal(error: unknown): RequestRefusal {
  if (error instanceof RequestRefusal) return error;
  if (error instanceof ValidationError) {
    return new RequestRefusal(invalidRequest(error.message));
  }
  if (error instanceof ConflictError) {
    return new RequestRefusal(refusedByState(error.message));
  }
  if (error instanceof InvalidPageCursorError) {
    return new RequestRefusal(error.refusal);
  }

  return new RequestRefusal(unexpectedFailure);
}

export const handleError: ErrorHandler = (error, context) => {
  const refusal = toRefusal(error);
  return context.json({ error: refusal.error }, refusal.status);
};
