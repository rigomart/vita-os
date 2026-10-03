import type { ApplicationError } from "@vita-os/contracts";

import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";

import type { CreateScope } from "../request-scope";

import { WorkerBindings } from "../http/context";
import { RequestRefusalSchemas, toRefusal } from "../http/errors";
import { attempt, database, failed } from "../operation";
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

/** Authentication executes in the incoming request, never while layers build. */
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
    if (!session) return yield* failed(authenticationRequired);
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
