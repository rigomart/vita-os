import { useCallback, useRef, useState } from "react";

import { useFeedback } from "../lib/feedback";

export type GuardedAsyncFeedback = {
  /** Success toast for structural actions. Omit for quiet inline edits. */
  successMessage?: string;
  /** Surface failures as toasts. Default true; set false for form inline errors. */
  errorToast?: boolean;
  getErrorMessage?: (error: unknown) => string;
};

export type GuardedAsyncResult<TResult> =
  | { ok: true; value: TResult }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

function defaultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function useGuardedAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult,
  feedback: GuardedAsyncFeedback = {},
) {
  const feedbackClient = useFeedback();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const {
    successMessage,
    errorToast = true,
    getErrorMessage = defaultErrorMessage,
  } = feedback;

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async (...args: TArgs): Promise<GuardedAsyncResult<TResult>> => {
      if (pendingRef.current) {
        return { ok: false, skipped: true };
      }

      pendingRef.current = true;
      setIsPending(true);
      setError(null);

      try {
        const value = await action(...args);
        if (successMessage) {
          feedbackClient.success(successMessage);
        }
        return { ok: true, value };
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        if (errorToast) {
          feedbackClient.error(message);
        }
        return { ok: false, skipped: false, error: message };
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [action, successMessage, errorToast, getErrorMessage, feedbackClient],
  );

  return { run, isPending, error, clearError };
}
