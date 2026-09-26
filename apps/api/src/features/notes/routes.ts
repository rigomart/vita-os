import type { NoteId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { invalidPagination } from "../../platform/d1/page-cursor";
import { readJsonBody, reply, scope } from "../../platform/http/context";
import { decodeLimit } from "../../platform/http/decode";
import { invalidRequest, refuse } from "../../platform/http/errors";
import { succeeded } from "../../platform/operation";
import {
  countOpenNotes,
  createNote,
  getDoneNotePage,
  listOpenNotes,
  markNoteDone,
  markNoteOpen,
  removeNote,
  updateNoteAttentionDate,
  updateNoteBody,
} from "./operations";
import {
  decodeAttentionDate,
  decodeBody,
  decodeCreateNote,
  decodeNoteState,
  NOTE_PAGE_SIZE,
} from "./requests";

/**
 * Standalone Notes: the collection, its count, its Done history, and the four
 * ways one Note changes.
 */
export const noteRoutes: Routes = (app) => {
  app.get("/v1/notes", async (context) =>
    reply(context, await listOpenNotes(scope(context))),
  );

  // The count travels wrapped, so the body is a JSON object like every other.
  app.get("/v1/notes/open-count", async (context) => {
    const result = await countOpenNotes(scope(context));
    return reply(
      context,
      result.ok ? succeeded({ count: result.value }) : result,
    );
  });

  app.get("/v1/notes/done", async (context) => {
    const limit =
      decodeLimit(context.req.query("limit"), NOTE_PAGE_SIZE) ??
      refuse(invalidPagination);
    const cursor = context.req.query("cursor");
    return reply(
      context,
      await getDoneNotePage(scope(context), {
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
    );
  });

  app.post("/v1/notes", async (context) => {
    const input =
      decodeCreateNote(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Note."));
    return reply(context, await createNote(scope(context), input), 201);
  });

  app.patch("/v1/notes/:noteId/body", async (context) => {
    const input =
      decodeBody(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Note."));
    return reply(
      context,
      await updateNoteBody(scope(context), {
        noteId: context.req.param("noteId") as NoteId,
        body: input.body,
      }),
    );
  });

  app.patch("/v1/notes/:noteId/attention-date", async (context) => {
    const input =
      decodeAttentionDate(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Attention Date."));
    return reply(
      context,
      await updateNoteAttentionDate(scope(context), {
        noteId: context.req.param("noteId") as NoteId,
        attentionDate: input.attentionDate,
      }),
    );
  });

  app.patch("/v1/notes/:noteId/state", async (context) => {
    const input =
      decodeNoteState(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Note state."));
    const target = { noteId: context.req.param("noteId") as NoteId };
    return reply(
      context,
      input.state === "done"
        ? await markNoteDone(scope(context), target)
        : await markNoteOpen(scope(context), target),
    );
  });

  app.delete("/v1/notes/:noteId", async (context) =>
    reply(
      context,
      await removeNote(scope(context), {
        noteId: context.req.param("noteId") as NoteId,
      }),
    ),
  );
};
