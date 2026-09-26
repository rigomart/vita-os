import type { ApplicationError } from "@vita-os/contracts";

export const areaNotFound: ApplicationError = {
  code: "not_found",
  message: "Area not found.",
  retryable: false,
};

/**
 * Threads of any state block deleting their Area: an Area is where Threads
 * live, and removing it would strand them.
 */
export const areaHasThreads: ApplicationError = {
  code: "conflict",
  message:
    "Cannot delete an area that has threads. Move or delete the threads first.",
  retryable: false,
};
