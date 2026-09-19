import type { MiddlewareHandler } from "hono";

import type { WorkerEnv } from "./env";

import { createAuth } from "./auth";
import { authenticationRequired } from "./errors";

export type Actor = { actorId: string };

type ActorEnvironment = {
  Bindings: WorkerEnv;
  Variables: { actor: Actor };
};

export function authenticatedActor(
  auth: ReturnType<typeof createAuth>,
): MiddlewareHandler<ActorEnvironment> {
  return async (context, next) => {
    const session = await auth.api.getSession({
      headers: context.req.raw.headers,
    });

    if (!session) {
      return context.json({ error: authenticationRequired }, 401);
    }

    context.set("actor", { actorId: session.user.id });
    await next();
  };
}
