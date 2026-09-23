/**
 * Stable application outcomes.
 *
 * Every operation either succeeds or fails with one of these codes. A missing
 * record and a record owned by somebody else both produce `not_found`, so a
 * caller cannot tell them apart.
 */
export interface ApplicationError {
  code:
    | "unauthorized"
    | "not_found"
    | "validation"
    | "conflict"
    | "unavailable"
    | "unexpected";
  message: string;
  retryable: boolean;
}

export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApplicationError };

/** What a command that stores nothing back to the caller reports. */
export interface CommandAcknowledgement {
  acknowledged: true;
}

export const commandAcknowledged: CommandAcknowledgement = {
  acknowledged: true,
};

export function isApplicationError(value: unknown): value is ApplicationError {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<ApplicationError>;
  return (
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean" &&
    (candidate.code === "unauthorized" ||
      candidate.code === "not_found" ||
      candidate.code === "validation" ||
      candidate.code === "conflict" ||
      candidate.code === "unavailable" ||
      candidate.code === "unexpected")
  );
}
