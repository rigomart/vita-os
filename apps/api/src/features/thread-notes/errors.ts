import type { ApplicationError } from "@vita-os/contracts";

export const threadNoteNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread note not found.",
  retryable: false,
};
