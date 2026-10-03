import { NotFound, RefusedByState } from "../../platform/failures";

export const threadNotFound = () =>
  new NotFound({ message: "Thread not found." });

/**
 * A Move command made against a Thread that has moved on, or naming a Move it
 * no longer holds. The stale expectation is the caller's own, so it is named
 * for what it is rather than as a generic change conflict, and it is not worth
 * retrying: a retry could act on a different Move.
 */
export const moveConflict = () =>
  new RefusedByState({ message: "The Thread's Moves have changed." });
