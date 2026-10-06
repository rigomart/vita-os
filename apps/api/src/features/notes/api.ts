import type { NoteId } from "@vita-os/contracts";

import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { Authentication } from "../../platform/auth/authenticated-scope";
import {
  CommandAck,
  Timestamp,
  ValidationMessage,
} from "../../platform/http/schemas";
import {
  CreateNoteBody,
  DoneNotesQuery,
  NoteBody,
  NoteFollowUp,
  NoteStateBody,
} from "./requests";

export const NoteIdSchema = Schema.String.pipe(
  Schema.refine((value): value is NoteId => value.length > 0),
);
export const NoteSchema = Schema.Struct({
  _id: NoteIdSchema,
  body: Schema.String,
  followUp: Schema.optionalKey(Timestamp),
  state: Schema.Literals(["open", "done"]),
  completedAt: Schema.optionalKey(Timestamp),
  createdAt: Timestamp,
  updatedAt: Schema.optionalKey(Timestamp),
});
const NotePageSchema = Schema.Struct({
  entries: Schema.Array(NoteSchema),
  nextCursor: Schema.optionalKey(Schema.String),
});
const NoteParams = { noteId: NoteIdSchema };

export const NotesApi = HttpApiGroup.make("notes")
  .add(
    HttpApiEndpoint.get("list", "/v1/notes", {
      success: Schema.Array(NoteSchema),
    }),
    HttpApiEndpoint.get("openCount", "/v1/notes/open-count", {
      success: Schema.Struct({ count: Timestamp }),
    }),
    HttpApiEndpoint.get("done", "/v1/notes/done", {
      query: DoneNotesQuery,
      success: NotePageSchema,
    }).annotate(ValidationMessage, "Invalid pagination."),
    HttpApiEndpoint.post("create", "/v1/notes", {
      payload: CreateNoteBody,
      success: NoteSchema.pipe(HttpApiSchema.status(201)),
    }).annotate(ValidationMessage, "Invalid Note."),
    HttpApiEndpoint.patch("body", "/v1/notes/:noteId/body", {
      params: NoteParams,
      payload: NoteBody,
      success: NoteSchema,
    }).annotate(ValidationMessage, "Invalid Note."),
    HttpApiEndpoint.patch("followUp", "/v1/notes/:noteId/follow-up", {
      params: NoteParams,
      payload: NoteFollowUp,
      success: NoteSchema,
    }).annotate(ValidationMessage, "Invalid Follow-up date."),
    HttpApiEndpoint.patch("state", "/v1/notes/:noteId/state", {
      params: NoteParams,
      payload: NoteStateBody,
      success: NoteSchema,
    }).annotate(ValidationMessage, "Invalid Note state."),
    HttpApiEndpoint.delete("remove", "/v1/notes/:noteId", {
      params: NoteParams,
      success: CommandAck,
    }),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
