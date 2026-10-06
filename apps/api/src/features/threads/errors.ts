import { NotFound, RefusedByState } from "../../platform/failures";

export const threadNotFound = () =>
  new NotFound({ message: "Thread not found." });

/**
 * A Task command made against a Thread that has moved on, or naming a Task it
 * no longer holds. The stale expectation is the caller's own, so it is named
 * for what it is rather than as a generic change conflict, and it is not worth
 * retrying: a retry could act on a different Task.
 */
/**
 * Compatibility (ADR 0032, removal in #402): an old client setting a Thread's
 * Follow-up date. The date now lives on the Thread's Tasks, so the request is
 * refused as a conflict that is not worth retrying, which makes the client
 * reload and learn the new shape.
 */
export const followUpMoved = () =>
  new RefusedByState({
    message:
      "A Thread no longer has a Follow-up date. Give one of its Tasks a date instead.",
  });

export const moveConflict = () =>
  new RefusedByState({ message: "The Thread's Tasks have changed." });
