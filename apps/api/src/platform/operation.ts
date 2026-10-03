import type { ApplicationError } from "@vita-os/contracts";

import { Effect } from "effect";

import { RequestRefusal, toRefusal } from "./http/errors";

/** Domain rules and native D1 rejections enter the same typed failure channel. */
export function attempt<T>(
  evaluate: () => T,
): Effect.Effect<T, RequestRefusal> {
  return Effect.try({ try: evaluate, catch: toRefusal });
}
export function database<T>(
  evaluate: () => Promise<T>,
): Effect.Effect<T, RequestRefusal> {
  return Effect.tryPromise({ try: evaluate, catch: toRefusal });
}
export function succeeded<T>(value: T): Effect.Effect<T> {
  return Effect.succeed(value);
}
export function failed(
  error: ApplicationError,
): Effect.Effect<never, RequestRefusal> {
  return Effect.fail(new RequestRefusal(error));
}
export const changeConflict: ApplicationError = {
  code: "conflict",
  message: "The record changed while this request was in flight.",
  retryable: true,
};
