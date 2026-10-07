import { ConflictError, ValidationError } from "@vita-os/core";
import { Result } from "better-result";

import type { OperationFailure } from "./failures";

import { InvalidPageCursorError } from "./d1/page-cursor";
import {
  InvalidInput,
  RefusedByState,
  SlugTaken,
  Unexpected,
} from "./failures";

/** A use case starts when called, with its authenticated scope supplied explicitly. */
export type Operation<A> = Promise<Result<A, OperationFailure>>;

/** Domain refusals keep their public words; other exceptions keep a private cause. */
export function attempt<T>(
  evaluate: () => T,
): Result<T, InvalidInput | RefusedByState | Unexpected> {
  try {
    return Result.ok(evaluate());
  } catch (cause) {
    if (cause instanceof ValidationError)
      return Result.err(new InvalidInput({ message: cause.message }));
    if (cause instanceof ConflictError)
      return Result.err(new RefusedByState({ message: cause.message }));
    return Result.err(new Unexpected({ cause }));
  }
}

/** Classify one D1 round trip; retry decisions stay in the owning operation. */
export function database<T>(
  evaluate: () => Promise<T>,
): Promise<Result<T, InvalidInput | Unexpected>>;
export function database<T>(
  evaluate: () => Promise<T>,
  isSlugTaken: (cause: unknown) => boolean,
): Promise<Result<T, SlugTaken | InvalidInput | Unexpected>>;
export function database<T>(
  evaluate: () => Promise<T>,
  isSlugTaken?: (cause: unknown) => boolean,
): Promise<Result<T, SlugTaken | InvalidInput | Unexpected>> {
  return Result.tryPromise({
    try: evaluate,
    catch: (cause) => {
      if (isSlugTaken?.(cause)) return new SlugTaken({ cause });
      if (cause instanceof InvalidPageCursorError)
        return new InvalidInput({ message: cause.refusal });
      return new Unexpected({ cause });
    },
  });
}
