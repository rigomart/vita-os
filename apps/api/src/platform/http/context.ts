import type { OperationResult } from "@vita-os/contracts";
import type { Context, Hono } from "hono";

import type { WorkerEnv } from "../env";
import type { RequestScope } from "../request-scope";

import { refuse } from "./errors";

/**
 * What every route in this Worker has in common: the bindings it reads, and a
 * request scope that exists only once the caller is authenticated.
 */
export type AppEnvironment = {
  Bindings: WorkerEnv;
  Variables: {
    scope: RequestScope;
  };
};

export type AppContext = Context<AppEnvironment>;
export type Routes = (app: Hono<AppEnvironment>) => void;

export function scope(context: AppContext): RequestScope {
  return context.get("scope");
}

/** The body a write carries, or `undefined` when it is not readable JSON. */
export async function readJsonBody(context: AppContext): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

/**
 * Answer with an operation's result. A failure goes to the one error handler,
 * so its status is decided in the same place as every other refusal.
 */
export function reply<T>(
  context: AppContext,
  result: OperationResult<T>,
  status: 200 | 201 = 200,
): Response {
  if (!result.ok) refuse(result.error);

  return context.json(result.value, status);
}
