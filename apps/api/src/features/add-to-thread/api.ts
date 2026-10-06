import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { Authentication } from "../../platform/auth/authenticated-scope";
import { ValidationMessage } from "../../platform/http/schemas";
import { AreaIdSchema } from "../areas/requests";
import { NoteIdSchema } from "../notes/api";
import { ThreadNoteSchema } from "../thread-notes/api";
import { ThreadSchema } from "../threads/api";
import { TaskIdSchema, ThreadIdSchema } from "../threads/requests";

const NoteAddedToThreadSchema = Schema.Struct({
  thread: ThreadSchema,
  threadNote: ThreadNoteSchema,
});
const NoteParams = { noteId: NoteIdSchema };

export const AddToThreadApi = HttpApiGroup.make("addToThread")
  .add(
    HttpApiEndpoint.post("addToThread", "/v1/notes/:noteId/add-to-thread", {
      params: NoteParams,
      payload: Schema.Struct({
        threadId: ThreadIdSchema,
        taskId: Schema.optionalKey(TaskIdSchema),
      }),
      success: NoteAddedToThreadSchema,
    }).annotate(ValidationMessage, "Invalid Thread."),
    HttpApiEndpoint.post("newThread", "/v1/notes/:noteId/new-thread", {
      params: NoteParams,
      payload: Schema.Struct({
        title: Schema.String,
        areaId: Schema.optional(AreaIdSchema),
        taskId: Schema.optionalKey(TaskIdSchema),
      }),
      success: NoteAddedToThreadSchema.pipe(HttpApiSchema.status(201)),
    }).annotate(ValidationMessage, "Invalid Thread."),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
