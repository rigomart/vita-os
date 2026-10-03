import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { Authentication } from "../../platform/auth/authenticated-scope";
import { invalidPagination } from "../../platform/d1/page-cursor";
import {
  CommandAck,
  PageQuery,
  Timestamp,
  ValidationMessage,
} from "../../platform/http/schemas";
import { ThreadIdSchema } from "../threads/requests";
import {
  ThreadNoteBody,
  ThreadNoteStateBody,
  ThreadNoteIdSchema,
} from "./requests";

export const ThreadNoteSchema = Schema.Struct({
  _id: ThreadNoteIdSchema,
  body: Schema.String,
  state: Schema.Literals(["open", "done"]),
  completedAt: Schema.optionalKey(Timestamp),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
const ThreadNotePageSchema = Schema.Struct({
  entries: Schema.Array(ThreadNoteSchema),
  nextCursor: Schema.optionalKey(Schema.String),
});
const ThreadParams = { threadId: ThreadIdSchema };
const ThreadNoteParams = { threadNoteId: ThreadNoteIdSchema };
export const ThreadNotesApi = HttpApiGroup.make("threadNotes")
  .add(
    HttpApiEndpoint.get("listOpen", "/v1/threads/:threadId/notes", {
      params: ThreadParams,
      success: Schema.Array(ThreadNoteSchema),
    }),
    HttpApiEndpoint.get("donePage", "/v1/threads/:threadId/notes/done", {
      params: ThreadParams,
      query: PageQuery,
      success: ThreadNotePageSchema,
    }).annotate(ValidationMessage, invalidPagination.message),
    HttpApiEndpoint.post("create", "/v1/threads/:threadId/notes", {
      params: ThreadParams,
      payload: ThreadNoteBody,
      success: ThreadNoteSchema.pipe(HttpApiSchema.status(201)),
    }).annotate(ValidationMessage, "Invalid Thread note."),
    HttpApiEndpoint.patch("updateBody", "/v1/thread-notes/:threadNoteId/body", {
      params: ThreadNoteParams,
      payload: ThreadNoteBody,
      success: ThreadNoteSchema,
    }).annotate(ValidationMessage, "Invalid Thread note."),
    HttpApiEndpoint.patch("setState", "/v1/thread-notes/:threadNoteId/state", {
      params: ThreadNoteParams,
      payload: ThreadNoteStateBody,
      success: ThreadNoteSchema,
    }).annotate(ValidationMessage, "Invalid Thread note state."),
    HttpApiEndpoint.delete("remove", "/v1/thread-notes/:threadNoteId", {
      params: ThreadNoteParams,
      success: CommandAck,
    }),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
