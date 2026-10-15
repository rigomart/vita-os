import type { Context } from "hono";

import { sValidator } from "@hono/standard-validator";
import { isPageLimit, type PageSize } from "@vita-os/operations";

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

/** A bounded page size; query conversion retains the existing Number semantics. */
export function decodeLimit(
  value: string | undefined,
  size: PageSize,
): number | undefined {
  if (value === undefined) return size.fallback;
  const limit = Number(value);
  return isPageLimit(limit, size) ? limit : undefined;
}
