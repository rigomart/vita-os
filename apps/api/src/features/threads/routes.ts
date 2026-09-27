import type { MoveId, ThreadId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { readJsonBody, reply, scope } from "../../platform/http/context";
import { invalidRequest, refuse } from "../../platform/http/errors";
import {
  addMove,
  completeMove,
  createThread,
  editMove,
  focusMove,
  getThreadDetail,
  listOpenThreads,
  removeMove,
  removeThread,
  updateThread,
} from "./operations";
import {
  decodeAddMove,
  decodeCreateThread,
  decodeEditMove,
  decodeFocusMove,
  decodeMoveRevision,
  decodeUpdateThread,
} from "./requests";

const invalidMoveCommand = () => refuse(invalidRequest("Invalid Move change."));

/** Threads and their Moves. */
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

  app.post("/v1/threads/:threadId/moves", async (context) => {
    const input =
      decodeAddMove(await readJsonBody(context)) ?? invalidMoveCommand();
    return reply(
      context,
      await addMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        ...input,
      }),
    );
  });

  app.patch("/v1/threads/:threadId/moves/:moveId", async (context) => {
    const input =
      decodeEditMove(await readJsonBody(context)) ?? invalidMoveCommand();
    return reply(
      context,
      await editMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        moveId: context.req.param("moveId") as MoveId,
        ...input,
      }),
    );
  });

  app.delete("/v1/threads/:threadId/moves/:moveId", async (context) => {
    const input =
      decodeMoveRevision(await readJsonBody(context)) ?? invalidMoveCommand();
    return reply(
      context,
      await removeMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        moveId: context.req.param("moveId") as MoveId,
        ...input,
      }),
    );
  });

  app.post("/v1/threads/:threadId/moves/:moveId/complete", async (context) => {
    const input =
      decodeMoveRevision(await readJsonBody(context)) ?? invalidMoveCommand();
    return reply(
      context,
      await completeMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        moveId: context.req.param("moveId") as MoveId,
        ...input,
      }),
    );
  });

  app.put("/v1/threads/:threadId/focus", async (context) => {
    const input =
      decodeFocusMove(await readJsonBody(context)) ?? invalidMoveCommand();
    return reply(
      context,
      await focusMove(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        ...input,
      }),
    );
  });
};
