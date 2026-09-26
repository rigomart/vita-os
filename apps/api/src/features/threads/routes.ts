import type { ThreadId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { readJsonBody, reply, scope } from "../../platform/http/context";
import { invalidRequest, refuse } from "../../platform/http/errors";
import { invalidNextMoveCompletion } from "./errors";
import {
  completeNextMove,
  createThread,
  getThreadDetail,
  listOpenThreads,
  removeThread,
  replaceUpNext,
  updateThread,
} from "./operations";
import {
  decodeCompleteNextMove,
  decodeCreateThread,
  decodeUpdateThread,
  decodeUpNext,
} from "./requests";

/** Threads, their Up Next line, and their Next Move. */
export const threadRoutes: Routes = (app) => {
  app.get("/v1/threads", async (context) =>
    reply(context, await listOpenThreads(scope(context))),
  );

  app.post("/v1/threads", async (context) => {
    const input =
      decodeCreateThread(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Thread."));
    return reply(context, await createThread(scope(context), input), 201);
  });

  app.get("/v1/threads/:slug", async (context) =>
    reply(
      context,
      await getThreadDetail(scope(context), {
        slug: context.req.param("slug"),
      }),
    ),
  );

  app.patch("/v1/threads/:threadId", async (context) => {
    const input =
      decodeUpdateThread(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Thread change."));
    return reply(
      context,
      await updateThread(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        ...input,
      }),
    );
  });

  app.delete("/v1/threads/:threadId", async (context) =>
    reply(
      context,
      await removeThread(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
      }),
    ),
  );

  app.put("/v1/threads/:threadId/up-next", async (context) => {
    const input =
      decodeUpNext(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Up Next."));
    return reply(
      context,
      await replaceUpNext(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        moves: input.moves,
      }),
    );
  });

  app.post("/v1/threads/:threadId/complete-next-move", async (context) => {
    const input =
      decodeCompleteNextMove(await readJsonBody(context)) ??
      refuse(invalidNextMoveCompletion);
    return reply(
      context,
      await completeNextMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        ...input,
      }),
    );
  });
};
