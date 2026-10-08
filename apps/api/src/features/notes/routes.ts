import {
  DoneNotesQuery,
  NoteBody,
  NoteIdSchema,
  NoteStateBody,
} from "@vita-os/contracts";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { refusalResponse, respond } from "../../platform/http/errors";
import { pageRequest } from "../../platform/http/schemas";
import {
  countOpenNotes,
  createNote,
  getDoneNotePage,
  listOpenNotes,
  markNoteDone,
  markNoteOpen,
  removeNote,
  updateNoteBody,
  updateNoteFollowUp,
} from "./operations";
import { CreateNoteBody, NOTE_PAGE_SIZE, NoteFollowUp } from "./requests";

const NoteParams = v.object({ noteId: NoteIdSchema });

/** Standalone Notes, their count and Done history, and changes to one Note. */
export const notesRoutes = new Hono<ApiEnv>()
  .get("/notes", async (c) => respond(await listOpenNotes(c.get("scope"))))
  .get("/notes/open-count", async (c) =>
    respond((await countOpenNotes(c.get("scope"))).map((count) => ({ count }))),
  )
  .get(
    "/notes/done",
    validate("query", DoneNotesQuery, "Invalid pagination."),
    async (c) => {
      const query = c.req.valid("query");
      const page = pageRequest(query, NOTE_PAGE_SIZE);
      if (page.status === "error") return refusalResponse(page.error);
      return respond(
        await getDoneNotePage(c.get("scope"), {
          ...page.value,
          ...(query.q === undefined ? {} : { query: query.q }),
        }),
      );
    },
  )
  .post(
    "/notes",
    validate("json", CreateNoteBody, "Invalid Note."),
    async (c) =>
      respond(await createNote(c.get("scope"), c.req.valid("json")), 201),
  )
  .patch(
    "/notes/:noteId/body",
    validate("param", NoteParams, "Invalid Note."),
    validate("json", NoteBody, "Invalid Note."),
    async (c) =>
      respond(
        await updateNoteBody(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .patch(
    "/notes/:noteId/follow-up",
    validate("param", NoteParams, "Invalid Follow-up date."),
    validate("json", NoteFollowUp, "Invalid Follow-up date."),
    async (c) =>
      respond(
        await updateNoteFollowUp(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .patch(
    "/notes/:noteId/state",
    validate("param", NoteParams, "Invalid Note state."),
    validate("json", NoteStateBody, "Invalid Note state."),
    async (c) =>
      respond(
        await (c.req.valid("json").state === "done"
          ? markNoteDone(c.get("scope"), c.req.valid("param"))
          : markNoteOpen(c.get("scope"), c.req.valid("param"))),
      ),
  )
  .delete(
    "/notes/:noteId",
    validate("param", NoteParams, "Invalid request."),
    async (c) =>
      respond(await removeNote(c.get("scope"), c.req.valid("param"))),
  );
