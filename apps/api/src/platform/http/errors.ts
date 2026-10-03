import type { ApplicationError } from "@vita-os/contracts";

import { ConflictError, ValidationError } from "@vita-os/core";
import { Schema, SchemaGetter } from "effect";
import { HttpServerResponse } from "effect/http";
import { HttpApiSchema } from "effect/http-api";

import { InvalidPageCursorError } from "../d1/page-cursor";

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
export function refusedByState(message: string): ApplicationError {
  return { code: "conflict", message, retryable: false };
}

/** Internal failure; only the public error is encoded into HTTP responses. */
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
export function toRefusal(cause: unknown): RequestRefusal {
  if (cause instanceof RequestRefusal) return cause;
  if (cause instanceof ValidationError) {
    return new RequestRefusal(invalidRequest(cause.message), undefined, cause);
  }
  if (cause instanceof ConflictError) {
    return new RequestRefusal(refusedByState(cause.message), undefined, cause);
  }
  if (cause instanceof InvalidPageCursorError) {
    return new RequestRefusal(cause.refusal, undefined, cause);
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
  return Schema.declare<RequestRefusal>(
    (value): value is RequestRefusal =>
      value instanceof RequestRefusal &&
      value.error.code === code &&
      value.status === status,
  ).pipe(
    Schema.encodeTo(wire, {
      decode: SchemaGetter.transform(
        (value) => new RequestRefusal(value.error, status),
      ),
      encode: SchemaGetter.transform((value) => ({
        error: { ...value.error, code },
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
