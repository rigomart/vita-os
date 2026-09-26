import type { ApplicationError } from "@vita-os/contracts";

export const threadNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread not found.",
  retryable: false,
};

export const invalidNextMoveCompletion: ApplicationError = {
  code: "validation",
  message: "Invalid Next Move completion.",
  retryable: false,
};

/**
 * A stale expectation is the caller's own, so it is named for what it is
 * rather than as a generic change conflict, and it is not worth retrying.
 */
export const nextMoveConflict: ApplicationError = {
  code: "conflict",
  message: "Next Move has changed.",
  retryable: false,
};
