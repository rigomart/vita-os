import { NotFound, RefusedByState } from "../../platform/failures";

export const threadNotFound = () =>
  new NotFound({ message: "Thread not found." });

/**
 * A Task command made against a Thread that has moved on, or naming a Task it
 * no longer holds. The stale expectation is the caller's own, so it is named
 * for what it is rather than as a generic change conflict, and it is not worth
 * retrying: a retry could act on a different Task.
 */
export const moveConflict = () =>
  new RefusedByState({ message: "The Thread's Tasks have changed." });
