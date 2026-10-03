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
  Revision,
  Timestamp,
  ValidationMessage,
} from "../../platform/http/schemas";
import { AreaSummarySchema } from "../areas/api";
import { AreaIdSchema } from "../areas/requests";
import {
  AddMoveBody,
  CreateThreadBody,
  EditMoveBody,
  FocusMoveBody,
  MoveRevisionBody,
  UpdateThreadBody,
  ThreadIdSchema,
  MoveIdSchema,
} from "./requests";

export const ThreadSchema = Schema.Struct({
  _id: ThreadIdSchema,
  title: Schema.String,
  slug: Schema.String,
  summary: Schema.optionalKey(Schema.String),
  areaId: Schema.optionalKey(AreaIdSchema),
  order: Timestamp,
  state: Schema.Literals(["open", "resolved"]),
  moves: Schema.optionalKey(
    Schema.Array(Schema.Struct({ _id: MoveIdSchema, text: Schema.String })),
  ),
  focusedMoveId: Schema.optionalKey(MoveIdSchema),
  followUp: Schema.optionalKey(Timestamp),
  lastActivityAt: Schema.optionalKey(Timestamp),
  lastActivityContent: Schema.optionalKey(Schema.String),
  createdAt: Timestamp,
  revision: Revision,
});
export const ThreadDetailSchema = Schema.Struct({
  thread: ThreadSchema,
  area: Schema.optionalKey(AreaSummarySchema),
});
const ThreadParams = { threadId: ThreadIdSchema };
const MoveParams = { threadId: ThreadIdSchema, moveId: MoveIdSchema };

export const ThreadsApi = HttpApiGroup.make("threads")
  .add(
    HttpApiEndpoint.get("listOpen", "/v1/threads", {
      success: Schema.Array(ThreadSchema),
    }),
    HttpApiEndpoint.get("listResolved", "/v1/threads/resolved", {
      success: Schema.Array(ThreadSchema),
    }),
    HttpApiEndpoint.post("create", "/v1/threads", {
      payload: CreateThreadBody,
      success: ThreadSchema.pipe(HttpApiSchema.status(201)),
    }).annotate(ValidationMessage, "Invalid Thread."),
    HttpApiEndpoint.get("detail", "/v1/threads/:slug", {
      params: { slug: Schema.String },
      success: ThreadDetailSchema,
    }),
    HttpApiEndpoint.patch("update", "/v1/threads/:threadId", {
      params: ThreadParams,
      payload: UpdateThreadBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Thread change."),
    HttpApiEndpoint.delete("remove", "/v1/threads/:threadId", {
      params: ThreadParams,
      success: CommandAck,
    }),
    HttpApiEndpoint.post("addMove", "/v1/threads/:threadId/moves", {
      params: ThreadParams,
      payload: AddMoveBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Move change."),
    HttpApiEndpoint.patch("editMove", "/v1/threads/:threadId/moves/:moveId", {
      params: MoveParams,
      payload: EditMoveBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Move change."),
    HttpApiEndpoint.delete(
      "removeMove",
      "/v1/threads/:threadId/moves/:moveId",
      {
        params: MoveParams,
        payload: MoveRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Move change."),
    HttpApiEndpoint.post(
      "completeMove",
      "/v1/threads/:threadId/moves/:moveId/complete",
      {
        params: MoveParams,
        payload: MoveRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Move change."),
    HttpApiEndpoint.put("focusMove", "/v1/threads/:threadId/focus", {
      params: ThreadParams,
      payload: FocusMoveBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Move change."),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
