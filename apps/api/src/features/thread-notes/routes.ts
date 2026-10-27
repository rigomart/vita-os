import {
  ThreadIdSchema,
  ThreadNoteBody,
  ThreadNoteIdSchema,
} from "@vita-os/contracts";
import {
  createThreadNote,
  listThreadNotes,
  removeThreadNote,
  updateThreadNoteBody,
} from "@vita-os/operations";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { respond } from "../../platform/http/errors";

const ThreadParams = v.object({ threadId: ThreadIdSchema });
const ThreadNoteParams = v.object({ threadNoteId: ThreadNoteIdSchema });

/** Notes captured inside one Thread. */
export const threadNotesRoutes = new Hono<ApiEnv>()
  .get(
    "/threads/:threadId/notes",
    validate("param", ThreadParams, "Invalid request."),
    async (c) =>
      respond(await listThreadNotes(c.get("scope"), c.req.valid("param"))),
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
  .delete(
    "/thread-notes/:threadNoteId",
    validate("param", ThreadNoteParams, "Invalid request."),
    async (c) =>
      respond(await removeThreadNote(c.get("scope"), c.req.valid("param"))),
  );
