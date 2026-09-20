import type { ThreadId } from "@vita-os/contracts";

import type { Routes } from "./shared";

import {
  areaNotFound,
  invalidActivityPagination,
  invalidNextMoveCompletion,
  invalidRequest,
  nextMoveConflict,
  threadNotFound,
} from "../errors";
import { InvalidPageCursorError } from "../page-cursor";
import {
  ACTIVITY_PAGE_SIZE,
  decodeCompleteNextMove,
  decodeCreateThread,
  decodeLimit,
  decodeUpdateThread,
  decodeUpNext,
} from "../requests";
import { actorId, readJsonBody, refuse, respond, store } from "./shared";

/** Threads, their Up Next line, their Next Move, and their Activity Log. */
export const threadRoutes: Routes = (app) => {
  app.get("/v1/threads", async (context) =>
    context.json(
      await store(context).threads.listOpenThreads({
        actorId: actorId(context),
      }),
    ),
  );

  app.post("/v1/threads", async (context) => {
    const input = decodeCreateThread(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Thread."));
    }

    // A Thread can only be created inside an Area the actor owns, so the outcome
    // names the Area when the destination is not theirs.
    return respond(
      context,
      await store(context).threads.createThread({
        actorId: actorId(context),
        ...input,
      }),
      areaNotFound,
      { createdStatus: true },
    );
  });

  app.get("/v1/threads/:slug", async (context) =>
    respond(
      context,
      await store(context).threads.getThreadDetail({
        actorId: actorId(context),
        slug: context.req.param("slug"),
      }),
      threadNotFound,
    ),
  );

  app.patch("/v1/threads/:threadId", async (context) => {
    const input = decodeUpdateThread(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Thread change."));
    }

    return respond(
      context,
      await store(context).threads.updateThread({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
        ...input,
      }),
      threadNotFound,
    );
  });

  app.delete("/v1/threads/:threadId", async (context) =>
    respond(
      context,
      await store(context).threads.removeThread({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
      }),
      threadNotFound,
    ),
  );

  app.put("/v1/threads/:threadId/up-next", async (context) => {
    const input = decodeUpNext(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Up Next."));
    }

    return respond(
      context,
      await store(context).threads.replaceUpNext({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
        moves: input.moves,
      }),
      threadNotFound,
    );
  });

  app.post("/v1/threads/:threadId/complete-next-move", async (context) => {
    const input = decodeCompleteNextMove(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidNextMoveCompletion);
    }

    const result = await store(context).threads.completeNextMove({
      actorId: actorId(context),
      threadId: context.req.param("threadId") as ThreadId,
      ...input,
    });
    if (result.status === "not_found") {
      return context.json({ error: threadNotFound }, 404);
    }
    // A stale expectation is the caller's own, so it is named for what it is
    // rather than as a generic change conflict.
    if (result.status === "conflict") {
      return context.json({ error: nextMoveConflict }, 409);
    }

    return context.json(result.value);
  });

  app.get("/v1/threads/:threadId/activity", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), ACTIVITY_PAGE_SIZE);
    if (limit === undefined) {
      return context.json({ error: invalidActivityPagination }, 400);
    }

    const cursor = context.req.query("cursor");
    try {
      return respond(
        context,
        await store(context).threads.getThreadActivityPage({
          actorId: actorId(context),
          threadId: context.req.param("threadId") as ThreadId,
          limit,
          ...(cursor === undefined ? {} : { cursor }),
        }),
        threadNotFound,
      );
    } catch (error) {
      if (error instanceof InvalidPageCursorError) {
        return context.json({ error: invalidActivityPagination }, 400);
      }
      throw error;
    }
  });
};
