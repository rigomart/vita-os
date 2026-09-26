import type { ApplicationError } from "@vita-os/contracts";

/** Kept for the Activity Log's own wording, which callers already recognize. */
export const invalidActivityPagination: ApplicationError = {
  code: "validation",
  message: "Invalid Activity Log pagination.",
  retryable: false,
};
