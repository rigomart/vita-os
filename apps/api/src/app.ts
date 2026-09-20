import { ConflictError, ValidationError } from "@vita-os/core";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Actor } from "./authenticated-actor";
import type { WorkerEnv } from "./env";
import type { AppEnvironment } from "./routes/shared";
import type { VitaStore } from "./store";

import { createAuth } from "./auth";
import { authenticatedActor } from "./authenticated-actor";
import { createD1VitaStore } from "./d1-vita-store";
import {
  invalidPagination,
  invalidRequest,
  jsonRequestRequired,
  refusedByState,
  requestOriginNotAllowed,
  unexpectedFailure,
} from "./errors";
import { InvalidPageCursorError } from "./page-cursor";
import { areaRoutes } from "./routes/areas";
import { noteRoutes } from "./routes/notes";
import { threadNoteRoutes } from "./routes/thread-notes";
import { threadRoutes } from "./routes/threads";

export type CreateStore = (actor: Actor) => VitaStore;

export interface AppDependencies {
  createStore?: CreateStore;
}

/**
 * The Worker, composed.
 *
 * This file owns only what every route shares: who may call, who is calling,
 * what storage they are given, and how a refused rule becomes a response. The
 * routes themselves live one module per kind of record.
 */
export function createApp(
  env: WorkerEnv,
  dependencies: AppDependencies = {},
): Hono<AppEnvironment> {
  const auth = createAuth(env);
  const createStore =
    dependencies.createStore ?? (() => createD1VitaStore(env.DB));
  const browserOrigin = new URL(env.BROWSER_ORIGIN).origin;
  const credentialedCors = cors({ origin: browserOrigin, credentials: true });
  const app = new Hono<AppEnvironment>();

  // A rule that refuses says why in its own words; anything else says nothing.
  app.onError((error, context) => {
    if (error instanceof ValidationError) {
      return context.json({ error: invalidRequest(error.message) }, 400);
    }
    if (error instanceof ConflictError) {
      return context.json({ error: refusedByState(error.message) }, 409);
    }
    if (error instanceof InvalidPageCursorError) {
      return context.json({ error: invalidPagination }, 400);
    }

    return context.json({ error: unexpectedFailure }, 500);
  });

  app.use("/api/auth/*", credentialedCors);
  app.all("/api/auth/*", (context) => auth.handler(context.req.raw));

  app.use("/v1/*", credentialedCors);
  app.use("/v1/*", async (context, next) => {
    const method = context.req.method;
    if (method === "OPTIONS" || method === "GET" || method === "HEAD") {
      return next();
    }

    const origin = context.req.header("origin");
    if (origin !== undefined && origin !== browserOrigin) {
      return context.json({ error: requestOriginNotAllowed }, 403);
    }

    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const mediaType = context.req
        .header("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== "application/json") {
        return context.json({ error: jsonRequestRequired }, 415);
      }
    }

    await next();
  });
  app.use("/v1/*", authenticatedActor(auth));
  app.use("/v1/*", async (context, next) => {
    context.set("store", createStore(context.get("actor")));
    await next();
  });

  areaRoutes(app);
  threadRoutes(app);
  threadNoteRoutes(app);
  noteRoutes(app);

  return app;
}
