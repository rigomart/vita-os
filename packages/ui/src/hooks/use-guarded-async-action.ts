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

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const RAW_ERROR_PATTERNS = [
  /\[CONVEX [^\]]+\]/,
  /Server Error/i,
  /Failed to insert or update a document/i,
  /does not match the schema/i,
  /Object contains extra field/i,
  /Validator:/i,
  /\bat (?:async )?\S+/,
];

function getErrorText(error: unknown): string | null {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return null;
}

function getConvexUserMessage(message: string): string | null {
  const match = message.match(/Uncaught Error:\s*([^\n]+)/);
  return match?.[1]?.trim() || null;
}

function isRawInternalMessage(message: string): boolean {
  return RAW_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function defaultErrorMessage(error: unknown): string {
  const message = getErrorText(error);
  if (!message) return GENERIC_ERROR_MESSAGE;

  const convexUserMessage = getConvexUserMessage(message);
  if (convexUserMessage && !isRawInternalMessage(convexUserMessage)) {
    return convexUserMessage;
  }

  if (isRawInternalMessage(message)) return GENERIC_ERROR_MESSAGE;

  return message;
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
