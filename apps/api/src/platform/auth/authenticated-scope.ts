import type { ApplicationError } from "@vita-os/contracts";
import type { MiddlewareHandler } from "hono";

import type { AppEnvironment } from "../http/context";
import type { CreateScope } from "../request-scope";

import { refuse } from "../http/errors";
import { createAuth } from "./auth";

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

/**
 * Resolve who is calling, then build the request scope around them.
 *
 * The scope is the only way a route reaches storage, so a request without a
 * session is refused before anything is constructed. Better Auth starts
 * asynchronous initialization when constructed; building it here keeps that
 * work in the request that uses it, and preflight or rejected requests need no
 * auth at all.
 */
export function authenticatedScope(
  createScope: CreateScope,
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const session = await createAuth(context.env).api.getSession({
      headers: context.req.raw.headers,
    });
    if (!session) refuse(authenticationRequired);

    context.set(
      "scope",
      createScope({ db: context.env.DB, actorId: session.user.id }),
    );
    await next();
  };
}
