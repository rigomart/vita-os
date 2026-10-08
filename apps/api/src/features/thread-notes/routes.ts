import {
  PageQuery,
  ThreadIdSchema,
  ThreadNoteBody,
  ThreadNoteIdSchema,
  ThreadNoteStateBody,
} from "@vita-os/contracts";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { invalidPagination } from "../../platform/d1/page-cursor";
import { validate } from "../../platform/http/decode";
import { refusalResponse, respond } from "../../platform/http/errors";
import { pageRequest } from "../../platform/http/schemas";
import {
  createThreadNote,
  getDoneThreadNotePage,
  listOpenThreadNotes,
  markThreadNoteDone,
  markThreadNoteOpen,
  removeThreadNote,
  updateThreadNoteBody,
} from "./operations";

const NOTE_PAGE_SIZE = { fallback: 20, maximum: 50 };
const ThreadParams = v.object({ threadId: ThreadIdSchema });
const ThreadNoteParams = v.object({ threadNoteId: ThreadNoteIdSchema });

/** Notes captured inside one Thread. */
export const threadNotesRoutes = new Hono<ApiEnv>()
  .get(
    "/threads/:threadId/notes/done",
    validate("param", ThreadParams, invalidPagination.message),
    validate("query", PageQuery, invalidPagination.message),
    async (c) => {
      const page = pageRequest(c.req.valid("query"), NOTE_PAGE_SIZE);
      if (page.status === "error") return refusalResponse(page.error);
      return respond(
        await getDoneThreadNotePage(c.get("scope"), {
          ...c.req.valid("param"),
          ...page.value,
        }),
      );
    },
  )
  .get(
    "/threads/:threadId/notes",
    validate("param", ThreadParams, "Invalid request."),
    async (c) =>
      respond(await listOpenThreadNotes(c.get("scope"), c.req.valid("param"))),
  )
  .post(
    "/threads/:threadId/notes",
    validate("param", ThreadParams, "Invalid Thread note."),
    validate("json", ThreadNoteBody, "Invalid Thread note."),
    async (c) =>
      respond(
        await createThreadNote(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
        201,
      ),
  )
  .patch(
    "/thread-notes/:threadNoteId/body",
    validate("param", ThreadNoteParams, "Invalid Thread note."),
    validate("json", ThreadNoteBody, "Invalid Thread note."),
    async (c) =>
      respond(
        await updateThreadNoteBody(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .patch(
    "/thread-notes/:threadNoteId/state",
    validate("param", ThreadNoteParams, "Invalid Thread note state."),
    validate("json", ThreadNoteStateBody, "Invalid Thread note state."),
    async (c) => {
      const target = c.req.valid("param");
      return respond(
        await (c.req.valid("json").state === "done"
          ? markThreadNoteDone(c.get("scope"), target)
          : markThreadNoteOpen(c.get("scope"), target)),
      );
    },
  )
  .delete(
    "/thread-notes/:threadNoteId",
    validate("param", ThreadNoteParams, "Invalid request."),
    async (c) =>
      respond(await removeThreadNote(c.get("scope"), c.req.valid("param"))),
  );
