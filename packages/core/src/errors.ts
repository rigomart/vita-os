/**
 * What a domain rule says when it refuses.
 *
 * Core throws these instead of returning them: a refused write has no result
 * to carry, and every caller — a Worker route, a test, a future desktop host —
 * translates the same two kinds into the application's stable error codes.
 * The message is written for the person who triggered the write.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A rule that depends on the record's current state, not on the input. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
