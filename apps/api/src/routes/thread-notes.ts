import type { ThreadId, ThreadNoteId } from "@vita-os/contracts";

import type { Routes } from "./shared";

import {
  invalidPagination,
  invalidRequest,
  threadNoteNotFound,
  threadNotFound,
} from "../errors";
import {
  decodeBody,
  decodeLimit,
  decodeNoteState,
  NOTE_PAGE_SIZE,
} from "../requests";
import { actorId, readJsonBody, refuse, respond, store } from "./shared";

/**
 * Notes captured inside one Thread.
 *
 * Reads are addressed through the Thread that owns them; a single Note is
 * addressed by itself, because that is what the person is editing.
 */
export const threadNoteRoutes: Routes = (app) => {
  app.get("/v1/threads/:threadId/notes", async (context) =>
    respond(
      context,
      await store(context).threadNotes.listOpenThreadNotes({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
      }),
      threadNotFound,
    ),
  );

  app.get("/v1/threads/:threadId/notes/done", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), NOTE_PAGE_SIZE);
    if (limit === undefined) {
      return context.json({ error: invalidPagination }, 400);
    }

    const cursor = context.req.query("cursor");
    return respond(
      context,
      await store(context).threadNotes.getDoneThreadNotePage({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
      threadNotFound,
    );
  });

  app.post("/v1/threads/:threadId/notes", async (context) => {
    const input = decodeBody(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Thread note."));
    }

    return respond(
      context,
      await store(context).threadNotes.createThreadNote({
        actorId: actorId(context),
        threadId: context.req.param("threadId") as ThreadId,
        body: input.body,
      }),
      threadNotFound,
      { createdStatus: true },
    );
  });

  app.patch("/v1/thread-notes/:threadNoteId/body", async (context) => {
    const input = decodeBody(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Thread note."));
    }

    return respond(
      context,
      await store(context).threadNotes.updateThreadNoteBody({
        actorId: actorId(context),
        threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
        body: input.body,
      }),
      threadNoteNotFound,
    );
  });

  app.patch("/v1/thread-notes/:threadNoteId/state", async (context) => {
    const input = decodeNoteState(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Thread note state."));
    }

    const threadNotes = store(context).threadNotes;
    const target = {
      actorId: actorId(context),
      threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
    };
    return respond(
      context,
      input.state === "done"
        ? await threadNotes.markThreadNoteDone(target)
        : await threadNotes.markThreadNoteOpen(target),
      threadNoteNotFound,
    );
  });

  app.delete("/v1/thread-notes/:threadNoteId", async (context) =>
    respond(
      context,
      await store(context).threadNotes.removeThreadNote({
        actorId: actorId(context),
        threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
      }),
      threadNoteNotFound,
    ),
  );
};
