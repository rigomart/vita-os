import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ApiEnv } from "./platform/env";
import type { CreateScope } from "./platform/request-scope";

import { activityLogRoutes } from "./features/activity-log/routes";
import { addToThreadRoutes } from "./features/add-to-thread/routes";
import { areasRoutes } from "./features/areas/routes";
import { notesRoutes } from "./features/notes/routes";
import { threadNotesRoutes } from "./features/thread-notes/routes";
import { threadsRoutes } from "./features/threads/routes";
import { createAuth } from "./platform/auth/auth";
import { authenticatedScope } from "./platform/auth/authenticated-scope";
import {
  invalidRequest,
  RequestRefusal,
  refusalResponse,
  toRefusal,
} from "./platform/http/errors";
import { requestCors, requestGuards } from "./platform/http/guards";
import { attempt, database } from "./platform/operation";
import { createRequestScope } from "./platform/request-scope";

export interface AppDependencies {
  /** Replaces how an authenticated request's scope is built. For tests. */
  createScope?: CreateScope;
}

/** One app per isolate; bindings and the authenticated scope belong to each request. */
export function createApp({
  createScope = createRequestScope,
}: AppDependencies = {}): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>({ strict: true });
  app.use("*", async (c, next) => {
    await next();
    // Native copying preserves all Set-Cookie values and makes redirect headers mutable.
    c.res = new Response(c.res.body, c.res);
    c.res.headers.set("X-Vita-Version", c.env.APP_VERSION?.trim() ?? "");
  });
  app.onError((error, c) =>
    refusalResponse(
      error instanceof HTTPException && error.status === 400
        ? new RequestRefusal(
            invalidRequest(c.get("validationMessage") ?? "Invalid request."),
          )
        : toRefusal(error),
    ),
  );
  app.notFound((c) => c.text("404 Not Found", 404));

  const api = new Hono<ApiEnv>({ strict: true });
  api.use("*", requestCors, requestGuards, authenticatedScope(createScope));
  api.route("/", areasRoutes);
  api.route("/", threadsRoutes);
  api.route("/", notesRoutes);
  api.route("/", threadNotesRoutes);
  api.route("/", activityLogRoutes);
  api.route("/", addToThreadRoutes);
  app.route("/v1", api);

  const auth = new Hono<ApiEnv>({ strict: true });
  auth.use("*", requestCors);
  auth.all("*", async (c) => {
    const auth = attempt(() => createAuth(c.env));
    if (auth.status === "error") return refusalResponse(toRefusal(auth.error));
    const response = await database(() => auth.value.handler(c.req.raw));
    if (response.status === "error")
      return refusalResponse(toRefusal(response.error));
    return new Response(response.value.body, response.value);
  });
  app.route("/api/auth", auth);
  return app;
}
