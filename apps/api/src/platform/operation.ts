import type { ApplicationError, OperationResult } from "@vita-os/contracts";

/**
 * What every operation answers with: the contract's own result.
 *
 * Operations are where a missing record, a lost race, or a stale expectation is
 * named. Storage only reports what the database said; a domain rule that refuses
 * still throws, and the error handler translates it.
 */

export function succeeded<T>(value: T): OperationResult<T> {
  return { ok: true, value };
}

export function failed(error: ApplicationError): OperationResult<never> {
  return { ok: false, error };
}

/** The record moved underneath the request more often than it was retried. */
export const changeConflict: ApplicationError = {
  code: "conflict",
  message: "The record changed while this request was in flight.",
  retryable: true,
};
