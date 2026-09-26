import { Hono } from "hono";

import type { AppEnvironment } from "./platform/http/context";
import type { CreateScope } from "./platform/request-scope";

import { activityLogRoutes } from "./features/activity-log/routes";
import { areaRoutes } from "./features/areas/routes";
import { noteRoutes } from "./features/notes/routes";
import { threadNoteRoutes } from "./features/thread-notes/routes";
import { threadRoutes } from "./features/threads/routes";
import { createAuth } from "./platform/auth/auth";
import { authenticatedScope } from "./platform/auth/authenticated-scope";
import { handleError } from "./platform/http/errors";
import { credentialedCors, mutationGuard } from "./platform/http/guards";
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
 * holds no bindings of its own — each request reads them from `context.env` —
 * so the app is built once and serves every request.
 */
export function createApp({
  createScope = createRequestScope,
}: AppDependencies = {}): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();
  app.onError(handleError);

  app.use("/api/auth/*", credentialedCors);
  app.all("/api/auth/*", (context) =>
    createAuth(context.env).handler(context.req.raw),
  );

  app.use(
    "/v1/*",
    credentialedCors,
    mutationGuard,
    authenticatedScope(createScope),
  );

  areaRoutes(app);
  threadRoutes(app);
  activityLogRoutes(app);
  threadNoteRoutes(app);
  noteRoutes(app);

  return app;
}
