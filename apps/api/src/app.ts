import { Hono } from "hono";
import { cors } from "hono/cors";

import type { WorkerEnv } from "./env";

import { createAuth } from "./auth";
import { authenticatedActor, type Actor } from "./authenticated-actor";
import { unexpectedFailure } from "./errors";

type AppEnvironment = {
  Bindings: WorkerEnv;
  Variables: {
    actor: Actor;
    store: unknown;
  };
};

export type CreateStore = (actor: Actor) => unknown;

export interface AppDependencies {
  createStore?: CreateStore;
}

export function createApp(
  env: WorkerEnv,
  dependencies: AppDependencies = {},
): Hono<AppEnvironment> {
  const auth = createAuth(env);
  const createStore = dependencies.createStore ?? (() => undefined);
  const credentialedCors = cors({
    origin: env.BROWSER_ORIGIN,
    credentials: true,
  });
  const app = new Hono<AppEnvironment>();

  app.onError((_error, context) =>
    context.json({ error: unexpectedFailure }, 500),
  );

  app.use("/api/auth/*", credentialedCors);
  app.all("/api/auth/*", (context) => auth.handler(context.req.raw));

  app.use("/v1/*", credentialedCors);
  app.use("/v1/*", authenticatedActor(auth));
  app.use("/v1/*", async (context, next) => {
    context.set("store", createStore(context.get("actor")));
    await next();
  });

  return app;
}
