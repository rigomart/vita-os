import { ConflictError, ValidationError } from "@vita-os/core";
import { Effect } from "effect";

import type { OperationFailure } from "./failures";
import type { RequestContext } from "./request-scope";

import { InvalidPageCursorError } from "./d1/page-cursor";
import {
  InvalidInput,
  RefusedByState,
  SlugTaken,
  Unexpected,
} from "./failures";

/** A use case, run later against the request that supplies its context. */
export type Operation<A> = Effect.Effect<A, OperationFailure, RequestContext>;

/**
 * A domain rule that refuses by throwing. A rule that refuses says why in its
 * own words; anything else says nothing.
 */
export function attempt<T>(
  evaluate: () => T,
): Effect.Effect<T, InvalidInput | RefusedByState | Unexpected> {
  return Effect.try({
    try: evaluate,
    catch: (cause) => {
      if (cause instanceof ValidationError) {
        return new InvalidInput({ message: cause.message });
      }
      if (cause instanceof ConflictError) {
        return new RefusedByState({ message: cause.message });
      }
      return new Unexpected({ cause });
    },
  });
}

/**
 * One native D1 round trip. A rejection is classified here, where the original
 * database error is still at hand: the unique violation `isSlugTaken`
 * recognizes is a `SlugTaken` the caller retries, a cursor this Worker did not
 * mint is the caller's input, and anything else is unexpected.
 */
export function database<T>(
  evaluate: () => Promise<T>,
): Effect.Effect<T, InvalidInput | Unexpected>;
export function database<T>(
  evaluate: () => Promise<T>,
  isSlugTaken: (cause: unknown) => boolean,
): Effect.Effect<T, SlugTaken | InvalidInput | Unexpected>;
export function database<T>(
  evaluate: () => Promise<T>,
  isSlugTaken?: (cause: unknown) => boolean,
): Effect.Effect<T, SlugTaken | InvalidInput | Unexpected> {
  return Effect.tryPromise({
    try: evaluate,
    catch: (cause) => {
      if (isSlugTaken?.(cause)) return new SlugTaken({ cause });
      if (cause instanceof InvalidPageCursorError) {
        return new InvalidInput({ message: cause.refusal.message });
      }
      return new Unexpected({ cause });
    },
  });
}
