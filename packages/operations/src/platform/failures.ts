import type { ApplicationError } from "@vita-os/contracts";

import { TaggedError } from "better-result";

/** A missing record and another actor's record have the same public refusal. */
export class NotFound extends TaggedError("NotFound")<{
  readonly message: string;
}> {}
export class InvalidInput extends TaggedError("InvalidInput")<{
  readonly message: string;
}> {}
export class RefusedByState extends TaggedError("RefusedByState")<{
  readonly message: string;
}> {}
export class ChangeConflict extends TaggedError("ChangeConflict") {
  override message = "The record changed while this request was in flight.";
}
/** Private failures retain their cause but never expose it in HTTP responses. */
export class Unexpected extends TaggedError("Unexpected")<{
  readonly cause: unknown;
}> {}
/** A slug collision is retried inside its operation and never reaches HTTP. */
export class SlugTaken extends TaggedError("SlugTaken")<{
  readonly cause: unknown;
}> {}

export const operationFailures = [
  NotFound,
  InvalidInput,
  RefusedByState,
  ChangeConflict,
  Unexpected,
] as const;
export type OperationFailure = InstanceType<(typeof operationFailures)[number]>;

export const unexpectedFailure: ApplicationError = {
  code: "unexpected",
  message: "Unexpected error.",
  retryable: false,
};

/** What a caller is told about a failure; an unexpected one keeps its cause private. */
export function toApplicationError(
  failure: OperationFailure,
): ApplicationError {
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
