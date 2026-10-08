import type { Context } from "hono";

import { sValidator } from "@hono/standard-validator";

import type { ApiEnv } from "../env";

import { invalidRequest, RequestRefusal, refusalResponse } from "./errors";

/** Set the endpoint's message before Hono reads JSON, including unreadable streams. */
export function validate<
  Schema extends Parameters<typeof sValidator>[1],
  Target extends "json" | "param" | "query",
>(target: Target, schema: Schema, message: string) {
  const validator = sValidator(
    target,
    schema,
    (result, _c: Context<ApiEnv>) => {
      if (!result.success)
        return refusalResponse(new RequestRefusal(invalidRequest(message)));
    },
  );
  return (
    c: Parameters<typeof validator>[0],
    next: Parameters<typeof validator>[1],
  ) => {
    c.set("validationMessage", message);
    return validator(c, next);
  };
}

/**
 * How large a page may be, per history.
 *
 * A caller that names no size gets the fallback; one that asks for more than the
 * maximum is refused rather than quietly served less, so an unbounded read cannot
 * be requested by accident.
 */
export type PageSize = { fallback: number; maximum: number };

/** A bounded page size; query conversion retains the existing Number semantics. */
export function decodeLimit(
  value: string | undefined,
  size: PageSize,
): number | undefined {
  if (value === undefined) return size.fallback;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= size.maximum
    ? limit
    : undefined;
}
