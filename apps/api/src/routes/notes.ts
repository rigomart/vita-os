import type { NoteId } from "@vita-os/contracts";

import type { Routes } from "./shared";

import { invalidPagination, invalidRequest, noteNotFound } from "../errors";
import {
  decodeAttentionDate,
  decodeBody,
  decodeCreateNote,
  decodeLimit,
  decodeNoteState,
  NOTE_PAGE_SIZE,
} from "../requests";
import { actorId, readJsonBody, refuse, respond, store } from "./shared";

/**
 * Standalone Notes: the collection, its count, its Done history, and the four
 * ways one Note changes.
 */
export const noteRoutes: Routes = (app) => {
  app.get("/v1/notes", async (context) =>
    context.json(
      await store(context).notes.listOpenNotes({ actorId: actorId(context) }),
    ),
  );

  app.get("/v1/notes/open-count", async (context) =>
    context.json({
      count: await store(context).notes.countOpenNotes({
        actorId: actorId(context),
      }),
    }),
  );

  app.get("/v1/notes/done", async (context) => {
    const limit = decodeLimit(context.req.query("limit"), NOTE_PAGE_SIZE);
    if (limit === undefined) {
      return context.json({ error: invalidPagination }, 400);
    }

    const cursor = context.req.query("cursor");
    return respond(
      context,
      await store(context).notes.getDoneNotePage({
        actorId: actorId(context),
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
      noteNotFound,
    );
  });

  app.post("/v1/notes", async (context) => {
    const input = decodeCreateNote(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Note."));
    }

    return respond(
      context,
      await store(context).notes.createNote({
        actorId: actorId(context),
        ...input,
      }),
      noteNotFound,
      { createdStatus: true },
    );
  });

  app.patch("/v1/notes/:noteId/body", async (context) => {
    const input = decodeBody(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Note."));
    }

    return respond(
      context,
      await store(context).notes.updateNoteBody({
        actorId: actorId(context),
        noteId: context.req.param("noteId") as NoteId,
        body: input.body,
      }),
      noteNotFound,
    );
  });

  app.patch("/v1/notes/:noteId/attention-date", async (context) => {
    const input = decodeAttentionDate(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Attention Date."));
    }

    return respond(
      context,
      await store(context).notes.updateNoteAttentionDate({
        actorId: actorId(context),
        noteId: context.req.param("noteId") as NoteId,
        attentionDate: input.attentionDate,
      }),
      noteNotFound,
    );
  });

  app.patch("/v1/notes/:noteId/state", async (context) => {
    const input = decodeNoteState(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Note state."));
    }

    const notes = store(context).notes;
    const target = {
      actorId: actorId(context),
      noteId: context.req.param("noteId") as NoteId,
    };
    return respond(
      context,
      input.state === "done"
        ? await notes.markNoteDone(target)
        : await notes.markNoteOpen(target),
      noteNotFound,
    );
  });

  app.delete("/v1/notes/:noteId", async (context) =>
    respond(
      context,
      await store(context).notes.removeNote({
        actorId: actorId(context),
        noteId: context.req.param("noteId") as NoteId,
      }),
      noteNotFound,
    ),
  );
};
