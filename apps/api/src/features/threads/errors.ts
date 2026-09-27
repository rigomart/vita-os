import type { ApplicationError } from "@vita-os/contracts";

export const threadNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread not found.",
  retryable: false,
};

/**
 * A Move command made against a Thread that has moved on, or naming a Move it
 * no longer holds. The stale expectation is the caller's own, so it is named
 * for what it is rather than as a generic change conflict, and it is not worth
 * retrying: a retry could act on a different Move.
 */
export const moveConflict: ApplicationError = {
  code: "conflict",
  message: "The Thread's Moves have changed.",
  retryable: false,
};
