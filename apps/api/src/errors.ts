import type { ApplicationError } from "@vita-os/contracts";

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

export const requestOriginNotAllowed: ApplicationError = {
  code: "unauthorized",
  message: "Request origin is not allowed.",
  retryable: false,
};

export const jsonRequestRequired: ApplicationError = {
  code: "validation",
  message: "JSON request body required.",
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

export const invalidNextMoveCompletion: ApplicationError = {
  code: "validation",
  message: "Invalid Next Move completion.",
  retryable: false,
};

export const nextMoveConflict: ApplicationError = {
  code: "conflict",
  message: "Next Move has changed.",
  retryable: false,
};

export const unexpectedFailure: ApplicationError = {
  code: "unexpected",
  message: "Unexpected error.",
  retryable: false,
};
