import type { ApplicationError } from "@vita-os/contracts";

export const areaNotFound: ApplicationError = {
  code: "not_found",
  message: "Area not found.",
  retryable: false,
};

/**
 * A reorder names the owner's whole Area list. A list that has since gained or
 * lost an Area would silently misplace it, so it is refused instead.
 */
export const areaOrderMismatch: ApplicationError = {
  code: "conflict",
  message: "The Area order must name every Area exactly once.",
  retryable: false,
};
