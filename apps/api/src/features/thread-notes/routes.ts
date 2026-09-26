import type { ThreadId, ThreadNoteId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { invalidPagination } from "../../platform/d1/page-cursor";
import { readJsonBody, reply, scope } from "../../platform/http/context";
import { decodeLimit } from "../../platform/http/decode";
import { invalidRequest, refuse } from "../../platform/http/errors";
import { decodeBody, decodeNoteState, NOTE_PAGE_SIZE } from "../notes/requests";
import {
  createThreadNote,
  getDoneThreadNotePage,
  listOpenThreadNotes,
  markThreadNoteDone,
  markThreadNoteOpen,
  removeThreadNote,
  updateThreadNoteBody,
} from "./operations";

/** Notes captured inside one Thread. */
export const threadNoteRoutes: Routes = (app) => {
  app.get("/v1/threads/:threadId/notes", async (context) =>
    reply(
      context,
      await listOpenThreadNotes(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
      }),
    ),
  );

  app.get("/v1/threads/:threadId/notes/done", async (context) => {
    const limit =
      decodeLimit(context.req.query("limit"), NOTE_PAGE_SIZE) ??
      refuse(invalidPagination);
    const cursor = context.req.query("cursor");
    return reply(
      context,
      await getDoneThreadNotePage(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
    );
  });

  app.post("/v1/threads/:threadId/notes", async (context) => {
    const input =
      decodeBody(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Thread note."));
    return reply(
      context,
      await createThreadNote(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        body: input.body,
      }),
      201,
    );
  });

  app.patch("/v1/thread-notes/:threadNoteId/body", async (context) => {
    const input =
      decodeBody(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Thread note."));
    return reply(
      context,
      await updateThreadNoteBody(scope(context), {
        threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
        body: input.body,
      }),
    );
  });

  app.patch("/v1/thread-notes/:threadNoteId/state", async (context) => {
    const input =
      decodeNoteState(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Thread note state."));
    const target = {
      threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
    };
    return reply(
      context,
      input.state === "done"
        ? await markThreadNoteDone(scope(context), target)
        : await markThreadNoteOpen(scope(context), target),
    );
  });

  app.delete("/v1/thread-notes/:threadNoteId", async (context) =>
    reply(
      context,
      await removeThreadNote(scope(context), {
        threadNoteId: context.req.param("threadNoteId") as ThreadNoteId,
      }),
    ),
  );
};
