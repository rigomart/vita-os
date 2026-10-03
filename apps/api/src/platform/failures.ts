import { Data } from "effect";

/**
 * How an operation fails.
 *
 * Operations are where a missing record, a lost race, or a stale expectation is
 * named. Each failure is a kind of refusal and, where the person sees one, its
 * words; the HTTP boundary decides how each kind reaches the caller.
 */

/**
 * A record the owner does not hold. A missing record and somebody else's read
 * the same, so a caller cannot use the difference to discover that somebody
 * else's record exists.
 */
export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string;
}> {}

/** A refused input, carrying the rule's own words for the person who typed it. */
export class InvalidInput extends Data.TaggedError("InvalidInput")<{
  readonly message: string;
}> {}

/** A refused write, because of the state the record is in. */
export class RefusedByState extends Data.TaggedError("RefusedByState")<{
  readonly message: string;
}> {}

/** The record moved underneath the request more often than it was retried. */
export class ChangeConflict extends Data.TaggedError("ChangeConflict") {
  override message = "The record changed while this request was in flight.";
}

/** Anything else keeps its cause and says nothing to the caller. */
export class Unexpected extends Data.TaggedError("Unexpected")<{
  readonly cause: unknown;
}> {}

/**
 * A write lost its slug to another of the owner's records. It never leaves an
 * operation, which mints another slug and gives up as a `ChangeConflict`.
 */
export class SlugTaken extends Data.TaggedError("SlugTaken")<{
  readonly cause: unknown;
}> {}

export type OperationFailure =
  | NotFound
  | InvalidInput
  | RefusedByState
  | ChangeConflict
  | Unexpected;
