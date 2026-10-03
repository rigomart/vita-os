import type { ApplicationError } from "@vita-os/contracts";

import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";

import type { CreateScope } from "../request-scope";

import { WorkerBindings } from "../http/context";
import {
  RequestRefusal,
  RequestRefusalSchemas,
  toRefusal,
} from "../http/errors";
import { attempt, database } from "../operation";
import { RequestContext } from "../request-scope";
import { createAuth } from "./auth";

export const authenticationRequired: ApplicationError = {
  code: "unauthorized",
  message: "Authentication required.",
  retryable: false,
};

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: RequestContext; requires: WorkerBindings }
>()("vita/Authentication", { error: RequestRefusalSchemas }) {}

/**
 * Resolve who is calling, then build the request scope around them.
 *
 * The scope is the only way a route reaches storage, so a request without a
 * session is refused before anything is constructed. Better Auth starts
 * asynchronous initialization when constructed; building it here keeps that
 * work in the request that uses it, and preflight or rejected requests need no
 * auth at all.
 */
export function authenticatedScope(createScope: CreateScope) {
  return Effect.gen(function* () {
    const env = yield* WorkerBindings;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(
      Effect.mapError(toRefusal),
    );
    const auth = yield* attempt(() => createAuth(env));
    const session = yield* database(() =>
      auth.api.getSession({ headers: rawRequest.headers }),
    );
    if (!session) {
      return yield* Effect.fail(new RequestRefusal(authenticationRequired));
    }
    return yield* attempt(() =>
      createScope({ db: env.DB, actorId: session.user.id }),
    );
  });
}

export function authenticationLayer(createScope: CreateScope) {
  return Layer.succeed(Authentication, (httpEffect) =>
    Effect.flatMap(authenticatedScope(createScope), (scope) =>
      Effect.provideService(httpEffect, RequestContext, scope),
    ),
  );
}
