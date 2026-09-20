import { Hono } from "hono";
import { cors } from "hono/cors";

import type { WorkerEnv } from "./env";

import {
  decodeActivityCursor,
  InvalidActivityCursorError,
} from "./activity-cursor";
import { createAuth } from "./auth";
import { authenticatedActor, type Actor } from "./authenticated-actor";
import { D1ThreadStore } from "./d1-thread-store";
import {
  invalidActivityPagination,
  invalidNextMoveCompletion,
  jsonRequestRequired,
  nextMoveConflict,
  requestOriginNotAllowed,
  threadNotFound,
  unexpectedFailure,
} from "./errors";

type AppEnvironment = {
  Bindings: WorkerEnv;
  Variables: {
    actor: Actor;
    store: D1ThreadStore;
  };
};

export type CreateStore = (actor: Actor) => D1ThreadStore;

export interface AppDependencies {
  createStore?: CreateStore;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompleteNextMoveBody(value: unknown): value is {
  expectedNextMove: string | null;
  expectedRevision: number;
} {
  if (
    !isObject(value) ||
    !Object.hasOwn(value, "expectedNextMove") ||
    !Object.hasOwn(value, "expectedRevision")
  ) {
    return false;
  }

  return (
    (value.expectedNextMove === null ||
      typeof value.expectedNextMove === "string") &&
    typeof value.expectedRevision === "number" &&
    Number.isSafeInteger(value.expectedRevision) &&
    value.expectedRevision >= 0
  );
}

export function createApp(
  env: WorkerEnv,
  dependencies: AppDependencies = {},
): Hono<AppEnvironment> {
  const auth = createAuth(env);
  const createStore =
    dependencies.createStore ?? (() => new D1ThreadStore(env.DB));
  const browserOrigin = new URL(env.BROWSER_ORIGIN).origin;
  const credentialedCors = cors({
    origin: browserOrigin,
    credentials: true,
  });
  const app = new Hono<AppEnvironment>();

  app.onError((_error, context) =>
    context.json({ error: unexpectedFailure }, 500),
  );

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

  app.get("/v1/threads/:slug", async (context) => {
    const detail = await context.get("store").getThreadDetail({
      actorId: context.get("actor").actorId,
      slug: context.req.param("slug"),
    });

    if (detail === null) {
      return context.json({ error: threadNotFound }, 404);
    }

    return context.json(detail);
  });

  app.get("/v1/threads/:threadId/activity", async (context) => {
    const limitQuery = context.req.query("limit");
    const limit = limitQuery === undefined ? 20 : Number(limitQuery);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      return context.json({ error: invalidActivityPagination }, 400);
    }

    const cursorQuery = context.req.query("cursor");
    let cursor;
    try {
      cursor =
        cursorQuery === undefined
          ? undefined
          : decodeActivityCursor(cursorQuery);
    } catch (error) {
      if (error instanceof InvalidActivityCursorError) {
        return context.json({ error: invalidActivityPagination }, 400);
      }
      throw error;
    }

    const page = await context.get("store").getThreadActivityPage({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId"),
      limit,
      cursor,
    });
    if (page === null) {
      return context.json({ error: threadNotFound }, 404);
    }

    return context.json(page);
  });

  app.post("/v1/threads/:threadId/complete-next-move", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: invalidNextMoveCompletion }, 400);
    }
    if (!isCompleteNextMoveBody(body)) {
      return context.json({ error: invalidNextMoveCompletion }, 400);
    }

    const result = await context.get("store").completeNextMove({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId"),
      expectedNextMove: body.expectedNextMove,
      expectedRevision: body.expectedRevision,
    });
    if (result.status === "not_found") {
      return context.json({ error: threadNotFound }, 404);
    }
    if (result.status === "conflict") {
      return context.json({ error: nextMoveConflict }, 409);
    }

    return context.json(result);
  });

  return app;
}
