import type { ApplicationError } from "@vita-os/contracts";
import type { MiddlewareHandler } from "hono";

import type { ApiEnv } from "../env";
import type { CreateScope } from "../request-scope";

import { RequestRefusal, refusalResponse, toRefusal } from "../http/errors";
import { attempt, database } from "../operation";
import { createAuth } from "./auth";

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

/** Resolve the session first, then create one scope for this request. */
export function authenticatedScope(
  createScope: CreateScope,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const auth = attempt(() => createAuth(c.env));
    if (auth.status === "error") return refusalResponse(toRefusal(auth.error));
    const session = await database(() =>
      auth.value.api.getSession({ headers: c.req.raw.headers }),
    );
    if (session.status === "error")
      return refusalResponse(toRefusal(session.error));
    if (!session.value)
      return refusalResponse(new RequestRefusal(authenticationRequired));
    const scope = attempt(() =>
      createScope({ db: c.env.DB, actorId: session.value!.user.id }),
    );
    if (scope.status === "error")
      return refusalResponse(toRefusal(scope.error));
    c.set("scope", scope.value);
    await next();
  };
}
