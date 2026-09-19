import type { ApplicationError } from "@vita-os/contracts";

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

export const threadNotFound: ApplicationError = {
  code: "not_found",
  message: "Thread not found.",
  retryable: false,
};

export const invalidActivityPagination: ApplicationError = {
  code: "validation",
  message: "Invalid Activity Log pagination.",
  retryable: false,
};

export const unexpectedFailure: ApplicationError = {
  code: "unexpected",
  message: "Unexpected error.",
  retryable: false,
};
