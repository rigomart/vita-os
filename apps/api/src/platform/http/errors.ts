import type { ApplicationError } from "@vita-os/contracts";

import { Schema, SchemaGetter } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiSchema } from "effect/http-api";

import type { OperationFailure } from "../failures";

import {
  ChangeConflict,
  InvalidInput,
  NotFound,
  RefusedByState,
  Unexpected,
} from "../failures";

/**
 * The one way a failure becomes a response.
 *
 * Every refusal — an unreadable request, an operation's failure, a domain rule
 * that threw, an edited cursor — reaches `toRefusal`, and its status comes from
 * its code.
 */

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

/**
 * A request this Worker will not answer with a value.
 *
 * The status is the code's own unless the refusal is about the transport
 * rather than the operation — a forbidden origin or a body that is not JSON.
 */
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

/** What HttpApi may encode as an error response. */
type Refusable = RequestRefusal | OperationFailure;

function isOperationFailure(value: unknown): value is OperationFailure {
  return (
    value instanceof NotFound ||
    value instanceof InvalidInput ||
    value instanceof RefusedByState ||
    value instanceof ChangeConflict ||
    value instanceof Unexpected
  );
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
  if (isOperationFailure(cause)) {
    return new RequestRefusal(publicError(cause), undefined, cause);
  }
  return new RequestRefusal(unexpectedFailure, undefined, cause);
}
export function refusalResponse(refusal: RequestRefusal) {
  return HttpServerResponse.jsonUnsafe(
    { error: refusal.error },
    { status: refusal.status },
  );
}

function refusalSchema<C extends ApplicationError["code"]>(code: C) {
  const status = STATUS_BY_CODE[code];
  const wire = Schema.Struct({
    error: Schema.Struct({
      code: Schema.Literal(code),
      message: Schema.String,
      retryable: Schema.Boolean,
    }),
  });
  return Schema.declare<Refusable>((value): value is Refusable => {
    if (!(value instanceof RequestRefusal || isOperationFailure(value))) {
      return false;
    }
    const refusal = toRefusal(value);
    return refusal.error.code === code && refusal.status === status;
  }).pipe(
    Schema.encodeTo(wire, {
      decode: SchemaGetter.transform(
        (value) => new RequestRefusal(value.error, status),
      ),
      encode: SchemaGetter.transform((value) => ({
        error: { ...toRefusal(value).error, code },
      })),
    }),
    HttpApiSchema.status(status),
  );
}

/** One codec per public status lets HttpApi choose the correct error response. */
export const RequestRefusalSchemas = [
  refusalSchema("unauthorized"),
  refusalSchema("not_found"),
  refusalSchema("validation"),
  refusalSchema("conflict"),
  refusalSchema("unavailable"),
  refusalSchema("unexpected"),
] as const;
