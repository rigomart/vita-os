import { Hono } from "hono";
import { cors } from "hono/cors";

import type { WorkerEnv } from "./env";

import { createAuth } from "./auth";
import { authenticatedActor, type Actor } from "./authenticated-actor";

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
  const app = new Hono<AppEnvironment>();

  app.use(
    "/api/auth/*",
    cors({ origin: env.BROWSER_ORIGIN, credentials: true }),
  );
  app.all("/api/auth/*", (context) => auth.handler(context.req.raw));

  app.use("/v1/*", authenticatedActor(auth));
  app.use("/v1/*", async (context, next) => {
    context.set("store", createStore(context.get("actor")));
    await next();
  });

  return app;
}
