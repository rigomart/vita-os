import type { ApplicationError } from "@vita-os/contracts";

export const noteNotFound: ApplicationError = {
  code: "not_found",
  message: "Note not found.",
  retryable: false,
};
