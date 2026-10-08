import type { ApplicationError } from "@vita-os/contracts";
import type { Result } from "better-result";

import type { OperationFailure } from "../failures";

import { operationFailures } from "../failures";

export const STATUS_BY_CODE: Record<ApplicationError["code"], number> = {
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
export function invalidRequest(message: string): ApplicationError {
  return { code: "validation", message, retryable: false };
}

/** Transport refusals can override their public code's usual status. */
export class RequestRefusal extends Error {
  readonly _tag = "RequestRefusal";
  constructor(
    readonly error: ApplicationError,
    readonly status: number = STATUS_BY_CODE[error.code],
    readonly cause?: unknown,
  ) {
    super(error.message);
    this.name = "RequestRefusal";
  }
}

function publicError(failure: OperationFailure): ApplicationError {
  switch (failure._tag) {
    case "NotFound":
      return { code: "not_found", message: failure.message, retryable: false };
    case "InvalidInput":
      return { code: "validation", message: failure.message, retryable: false };
    case "RefusedByState":
      return { code: "conflict", message: failure.message, retryable: false };
    case "ChangeConflict":
      return { code: "conflict", message: failure.message, retryable: true };
    case "Unexpected":
      return unexpectedFailure;
  }
}

export function toRefusal(cause: unknown): RequestRefusal {
  if (cause instanceof RequestRefusal) return cause;
  if (operationFailures.some((failure) => cause instanceof failure)) {
    return new RequestRefusal(
      publicError(cause as OperationFailure),
      undefined,
      cause,
    );
  }
  return new RequestRefusal(unexpectedFailure, undefined, cause);
}
export function refusalResponse(refusal: RequestRefusal): Response {
  return Response.json({ error: refusal.error }, { status: refusal.status });
}

/** Operations already return typed values. Only failures need HTTP translation. */
export function respond<A>(
  result: Result<A, OperationFailure>,
  status = 200,
): Response {
  return result.status === "ok"
    ? Response.json(result.value, { status })
    : refusalResponse(toRefusal(result.error));
}
