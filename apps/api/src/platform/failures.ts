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
