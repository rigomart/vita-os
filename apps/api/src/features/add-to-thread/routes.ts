import {
  AddNoteToThreadBody,
  CreateThreadFromNoteBody,
  NoteIdSchema,
} from "@vita-os/contracts";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { respond } from "../../platform/http/errors";
import { addNoteToThread, createThreadFromNote } from "./operations";

const NoteParams = v.object({ noteId: NoteIdSchema });
export const addToThreadRoutes = new Hono<ApiEnv>()
  .post(
    "/notes/:noteId/add-to-thread",
    validate("param", NoteParams, "Invalid Thread."),
    validate("json", AddNoteToThreadBody, "Invalid Thread."),
    async (c) =>
      respond(
        await addNoteToThread(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .post(
    "/notes/:noteId/new-thread",
    validate("param", NoteParams, "Invalid Thread."),
    validate("json", CreateThreadFromNoteBody, "Invalid Thread."),
    async (c) =>
      respond(
        await createThreadFromNote(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
        201,
      ),
  );
