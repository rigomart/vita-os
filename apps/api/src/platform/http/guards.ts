import type { MiddlewareHandler } from "hono";

import { cors } from "hono/cors";

import type { WorkerEnv } from "../env";

import { jsonRequestRequired, refuse, requestOriginNotAllowed } from "./errors";

/** The one browser origin allowed to call with credentials. */
function browserOrigin(env: WorkerEnv): string {
  return new URL(env.BROWSER_ORIGIN).origin;
}

export const credentialedCors = cors({
  origin: (origin, context) =>
    origin === browserOrigin(context.env as WorkerEnv) ? origin : null,
  credentials: true,
});

/**
 * Who may write, and in what form.
 *
 * Reads and preflights pass. A write from another origin is refused even when
 * it carries a valid cookie, and a write must be JSON, which a cross-site form
 * cannot send without a preflight.
 */
export const mutationGuard: MiddlewareHandler<{ Bindings: WorkerEnv }> = async (
  context,
  next,
) => {
  const method = context.req.method;
  if (method === "OPTIONS" || method === "GET" || method === "HEAD") {
    return next();
  }

  const origin = context.req.header("origin");
  if (origin !== undefined && origin !== browserOrigin(context.env)) {
    refuse(requestOriginNotAllowed, 403);
  }

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const mediaType = context.req
      .header("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      refuse(jsonRequestRequired, 415);
    }
  }

  await next();
};
