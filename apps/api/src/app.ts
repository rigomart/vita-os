import { Context, Effect, Layer } from "effect";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import type { WorkerEnv } from "./platform/env";
import type { CreateScope } from "./platform/request-scope";

import { ActivityLogHandlers } from "./features/activity-log/routes";
import { AddToThreadHandlers } from "./features/add-to-thread/routes";
import { AreasHandlers } from "./features/areas/routes";
import { NotesHandlers } from "./features/notes/routes";
import { ThreadNotesHandlers } from "./features/thread-notes/routes";
import { ThreadsHandlers } from "./features/threads/routes";
import { createAuth } from "./platform/auth/auth";
import { authenticationLayer } from "./platform/auth/authenticated-scope";
import { ApplicationApi, schemaErrorLayer } from "./platform/http/api";
import { WorkerBindings } from "./platform/http/context";
import { toRefusal } from "./platform/http/errors";
import { requestMiddleware } from "./platform/http/guards";
import { attempt, database } from "./platform/operation";
import { createRequestScope } from "./platform/request-scope";

export interface AppDependencies {
  /** Replaces how an authenticated request's scope is built. For tests. */
  createScope?: CreateScope;
}

/**
 * The Worker, composed.
 *
 * This file owns only what every route shares: who may call, who is calling,
 * the scope they are given, and the one way a failure becomes a response. It
 * holds no bindings of its own — each request supplies them — so the app is
 * built once and serves every request.
 */
export function createApp({
  createScope = createRequestScope,
}: AppDependencies = {}) {
  const handlers = Layer.mergeAll(
    NotesHandlers,
    AreasHandlers,
    ThreadsHandlers,
    ThreadNotesHandlers,
    ActivityLogHandlers,
    AddToThreadHandlers,
  ).pipe(
    Layer.provide(
      Layer.mergeAll(authenticationLayer(createScope), schemaErrorLayer),
    ),
  );
  const api = HttpApiBuilder.layer(ApplicationApi).pipe(
    Layer.provide(handlers),
    Layer.provide(HttpServer.layerServices),
  );
  const auth = HttpRouter.add(
    "*",
    "/api/auth/*",
    Effect.gen(function* () {
      const env = yield* WorkerBindings;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(
        Effect.mapError(toRefusal),
      );
      const auth = yield* attempt(() => createAuth(env));
      const response = yield* database(() => auth.handler(rawRequest));
      // Redirect responses can have immutable headers; native copying keeps
      // cookies intact and lets the outer CORS middleware add its headers.
      const mutableResponse = new Response(response.body, response);
      return HttpServerResponse.raw(mutableResponse, {
        status: response.status,
      });
    }),
  );
  const routing = Layer.mergeAll(api, auth, requestMiddleware(createScope));
  // HttpApiBuilder v4 treats middleware requirements as layer requirements.
  // Authentication reads these bindings only when a request is running, so
  // retain that dependency as the router's per-request requirement instead.
  const requestRouting = routing as Layer.Layer<
    Layer.Success<typeof routing>,
    Layer.Error<typeof routing>,
    | Exclude<Layer.Services<typeof routing>, WorkerBindings>
    | HttpRouter.Request<"Requires", WorkerBindings>
  >;
  const app = HttpRouter.toWebHandler(requestRouting, {
    disableLogger: true,
    // Exact paths keep routing consistent with the guard's /v1 boundary.
    routerConfig: {
      caseSensitive: true,
      ignoreTrailingSlash: false,
      ignoreDuplicateSlashes: false,
      maxParamLength: Number.POSITIVE_INFINITY,
    },
  });
  return {
    fetch: (
      request: Request,
      env: WorkerEnv,
      _context?: ExecutionContext,
    ): Promise<Response> =>
      app.handler(request, Context.make(WorkerBindings, env)),
    dispose: app.dispose,
  };
}
