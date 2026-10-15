import { NotFound, RefusedByState } from "../../platform/failures";

export const noteNotFound = () => new NotFound({ message: "Note not found." });

/**
 * Completing a repeating Note whose date is no longer the one the caller saw.
 * Not worth retrying: it would advance the Note a second time.
 */
export const noteOccurrenceChanged = () =>
  new RefusedByState({ message: "The Note's date has changed." });
