import type { ApplicationError, ThreadId } from "@vita-os/contracts";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { ConflictError, ValidationError } from "@vita-os/core";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Actor } from "./authenticated-actor";
import type { WorkerEnv } from "./env";
import type { StoreResult, StoreSubject, VitaStore } from "./store";

import { createAuth } from "./auth";
import { authenticatedActor } from "./authenticated-actor";
import { createD1VitaStore } from "./d1-vita-store";
import {
  areaNotFound,
  changeConflict,
  invalidActivityPagination,
  invalidNextMoveCompletion,
  invalidPagination,
  invalidRequest,
  jsonRequestRequired,
  nextMoveConflict,
  noteNotFound,
  refusedByState,
  requestOriginNotAllowed,
  threadNoteNotFound,
  threadNotFound,
  unexpectedFailure,
} from "./errors";
import { InvalidPageCursorError } from "./page-cursor";
import {
  decodeAttentionDate,
  decodeBody,
  decodeCompleteNextMove,
  decodeCreateArea,
  decodeCreateNote,
  decodeCreateThread,
  decodeLimit,
  decodeNoteState,
  decodeUpdateArea,
  decodeUpdateThread,
  decodeUpNext,
} from "./requests";

type AppEnvironment = {
  Bindings: WorkerEnv;
  Variables: {
    actor: Actor;
    store: VitaStore;
  };
};

export type CreateStore = (actor: Actor) => VitaStore;

export interface AppDependencies {
  createStore?: CreateStore;
}

const ACTIVITY_PAGE = { fallback: 20, maximum: 50 };
const NOTE_PAGE = { fallback: 20, maximum: 50 };

/**
 * Turn a storage outcome into a response.
 *
 * `not_found` always carries the record kind's own message and nothing about
 * whether the record exists for somebody else. `conflict` means the record moved
 * underneath the request, which is worth retrying.
 */
const NOT_FOUND_BY_SUBJECT: Record<StoreSubject, ApplicationError> = {
  area: areaNotFound,
  thread: threadNotFound,
  note: noteNotFound,
  thread_note: threadNoteNotFound,
};

function respond<T>(
  result: StoreResult<T>,
  notFoundError: ApplicationError,
): { body: unknown; status: ContentfulStatusCode } {
  if (result.status === "not_found") {
    const error =
      result.subject === undefined
        ? notFoundError
        : NOT_FOUND_BY_SUBJECT[result.subject];
    return { body: { error }, status: 404 };
  }
  if (result.status === "conflict") {
    return { body: { error: changeConflict }, status: 409 };
  }

  return { body: result.value, status: 200 };
}

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

  /** The body a write carries, or `undefined` when it is not readable JSON. */
  async function readJsonBody(request: Request): Promise<unknown> {
    try {
      return await request.json();
    } catch {
      return undefined;
    }
  }

  /* Areas ------------------------------------------------------------------ */

  app.get("/v1/areas", async (context) =>
    context.json(
      await context.get("store").areas.listAreas({
        actorId: context.get("actor").actorId,
      }),
    ),
  );

  app.get("/v1/areas/:slug", async (context) => {
    const result = await context.get("store").areas.getAreaDetail({
      actorId: context.get("actor").actorId,
      slug: context.req.param("slug"),
    });
    const { body, status } = respond(result, areaNotFound);
    return context.json(body, status);
  });

  app.post("/v1/areas", async (context) => {
    const input = decodeCreateArea(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidRequest("Invalid Area.") }, 400);
    }

    const result = await context.get("store").areas.createArea({
      actorId: context.get("actor").actorId,
      ...input,
    });
    const { body, status } = respond(result, areaNotFound);
    return context.json(body, status === 200 ? 201 : status);
  });

  app.patch("/v1/areas/:areaId", async (context) => {
    const input = decodeUpdateArea(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Area change.") },
        400,
      );
    }

    const result = await context.get("store").areas.updateArea({
      actorId: context.get("actor").actorId,
      areaId: context.req.param("areaId") as never,
      ...input,
    });
    const { body, status } = respond(result, areaNotFound);
    return context.json(body, status);
  });

  app.delete("/v1/areas/:areaId", async (context) => {
    const result = await context.get("store").areas.removeArea({
      actorId: context.get("actor").actorId,
      areaId: context.req.param("areaId") as never,
    });
    const { body, status } = respond(result, areaNotFound);
    return context.json(body, status);
  });

  /* Threads ---------------------------------------------------------------- */

  app.get("/v1/threads", async (context) =>
    context.json(
      await context.get("store").threads.listOpenThreads({
        actorId: context.get("actor").actorId,
      }),
    ),
  );

  app.post("/v1/threads", async (context) => {
    const input = decodeCreateThread(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidRequest("Invalid Thread.") }, 400);
    }

    const result = await context.get("store").threads.createThread({
      actorId: context.get("actor").actorId,
      ...input,
    });
    const { body, status } = respond(result, areaNotFound);
    return context.json(body, status === 200 ? 201 : status);
  });

  app.get("/v1/threads/:slug", async (context) => {
    const result = await context.get("store").threads.getThreadDetail({
      actorId: context.get("actor").actorId,
      slug: context.req.param("slug"),
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.patch("/v1/threads/:threadId", async (context) => {
    const input = decodeUpdateThread(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Thread change.") },
        400,
      );
    }

    const result = await context.get("store").threads.updateThread({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
      ...input,
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.delete("/v1/threads/:threadId", async (context) => {
    const result = await context.get("store").threads.removeThread({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.put("/v1/threads/:threadId/up-next", async (context) => {
    const input = decodeUpNext(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidRequest("Invalid Up Next.") }, 400);
    }

    const result = await context.get("store").threads.replaceUpNext({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
      moves: input.moves,
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.post("/v1/threads/:threadId/complete-next-move", async (context) => {
    const input = decodeCompleteNextMove(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidNextMoveCompletion }, 400);
    }

    const result = await context.get("store").threads.completeNextMove({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
      ...input,
    });
    if (result.status === "not_found") {
      return context.json({ error: threadNotFound }, 404);
    }
    if (result.status === "conflict") {
      return context.json({ error: nextMoveConflict }, 409);
    }

    return context.json(result.value);
  });

  app.get("/v1/threads/:threadId/activity", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), ACTIVITY_PAGE);
    if (limit === undefined) {
      return context.json({ error: invalidActivityPagination }, 400);
    }

    let result;
    try {
      result = await context.get("store").threads.getThreadActivityPage({
        actorId: context.get("actor").actorId,
        threadId: context.req.param("threadId") as ThreadId,
        limit,
        ...(context.req.query("cursor") === undefined
          ? {}
          : { cursor: context.req.query("cursor") as string }),
      });
    } catch (error) {
      if (error instanceof InvalidPageCursorError) {
        return context.json({ error: invalidActivityPagination }, 400);
      }
      throw error;
    }

    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  /* Thread Notes ----------------------------------------------------------- */

  app.get("/v1/threads/:threadId/notes", async (context) => {
    const result = await context.get("store").threadNotes.listOpenThreadNotes({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.get("/v1/threads/:threadId/notes/done", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), NOTE_PAGE);
    if (limit === undefined) {
      return context.json({ error: invalidPagination }, 400);
    }

    const result = await context
      .get("store")
      .threadNotes.getDoneThreadNotePage({
        actorId: context.get("actor").actorId,
        threadId: context.req.param("threadId") as ThreadId,
        limit,
        ...(context.req.query("cursor") === undefined
          ? {}
          : { cursor: context.req.query("cursor") as string }),
      });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status);
  });

  app.post("/v1/threads/:threadId/notes", async (context) => {
    const input = decodeBody(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Thread note.") },
        400,
      );
    }

    const result = await context.get("store").threadNotes.createThreadNote({
      actorId: context.get("actor").actorId,
      threadId: context.req.param("threadId") as ThreadId,
      body: input.body,
    });
    const { body, status } = respond(result, threadNotFound);
    return context.json(body, status === 200 ? 201 : status);
  });

  app.patch("/v1/thread-notes/:threadNoteId/body", async (context) => {
    const input = decodeBody(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Thread note.") },
        400,
      );
    }

    const result = await context.get("store").threadNotes.updateThreadNoteBody({
      actorId: context.get("actor").actorId,
      threadNoteId: context.req.param("threadNoteId") as never,
      body: input.body,
    });
    const { body, status } = respond(result, threadNoteNotFound);
    return context.json(body, status);
  });

  app.patch("/v1/thread-notes/:threadNoteId/state", async (context) => {
    const input = decodeNoteState(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Thread note state.") },
        400,
      );
    }

    const store = context.get("store").threadNotes;
    const actorId = context.get("actor").actorId;
    const threadNoteId = context.req.param("threadNoteId") as never;
    const result =
      input.state === "done"
        ? await store.markThreadNoteDone({ actorId, threadNoteId })
        : await store.markThreadNoteOpen({ actorId, threadNoteId });
    const { body, status } = respond(result, threadNoteNotFound);
    return context.json(body, status);
  });

  app.delete("/v1/thread-notes/:threadNoteId", async (context) => {
    const result = await context.get("store").threadNotes.removeThreadNote({
      actorId: context.get("actor").actorId,
      threadNoteId: context.req.param("threadNoteId") as never,
    });
    const { body, status } = respond(result, threadNoteNotFound);
    return context.json(body, status);
  });

  /* Standalone Notes ------------------------------------------------------- */

  app.get("/v1/notes", async (context) =>
    context.json(
      await context.get("store").notes.listOpenNotes({
        actorId: context.get("actor").actorId,
      }),
    ),
  );

  app.get("/v1/notes/open-count", async (context) =>
    context.json({
      count: await context.get("store").notes.countOpenNotes({
        actorId: context.get("actor").actorId,
      }),
    }),
  );

  app.get("/v1/notes/done", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), NOTE_PAGE);
    if (limit === undefined) {
      return context.json({ error: invalidPagination }, 400);
    }

    const result = await context.get("store").notes.getDoneNotePage({
      actorId: context.get("actor").actorId,
      limit,
      ...(context.req.query("cursor") === undefined
        ? {}
        : { cursor: context.req.query("cursor") as string }),
    });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status);
  });

  app.post("/v1/notes", async (context) => {
    const input = decodeCreateNote(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidRequest("Invalid Note.") }, 400);
    }

    const result = await context.get("store").notes.createNote({
      actorId: context.get("actor").actorId,
      ...input,
    });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status === 200 ? 201 : status);
  });

  app.patch("/v1/notes/:noteId/body", async (context) => {
    const input = decodeBody(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json({ error: invalidRequest("Invalid Note.") }, 400);
    }

    const result = await context.get("store").notes.updateNoteBody({
      actorId: context.get("actor").actorId,
      noteId: context.req.param("noteId") as never,
      body: input.body,
    });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status);
  });

  app.patch("/v1/notes/:noteId/attention-date", async (context) => {
    const input = decodeAttentionDate(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Attention Date.") },
        400,
      );
    }

    const result = await context.get("store").notes.updateNoteAttentionDate({
      actorId: context.get("actor").actorId,
      noteId: context.req.param("noteId") as never,
      when: input.when,
    });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status);
  });

  app.patch("/v1/notes/:noteId/state", async (context) => {
    const input = decodeNoteState(await readJsonBody(context.req.raw));
    if (input === undefined) {
      return context.json(
        { error: invalidRequest("Invalid Note state.") },
        400,
      );
    }

    const store = context.get("store").notes;
    const actorId = context.get("actor").actorId;
    const noteId = context.req.param("noteId") as never;
    const result =
      input.state === "done"
        ? await store.markNoteDone({ actorId, noteId })
        : await store.markNoteOpen({ actorId, noteId });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status);
  });

  app.delete("/v1/notes/:noteId", async (context) => {
    const result = await context.get("store").notes.removeNote({
      actorId: context.get("actor").actorId,
      noteId: context.req.param("noteId") as never,
    });
    const { body, status } = respond(result, noteNotFound);
    return context.json(body, status);
  });

  return app;
}
