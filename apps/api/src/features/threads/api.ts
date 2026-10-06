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
  AddTaskBody,
  CreateThreadBody,
  EditTaskBody,
  FocusTaskBody,
  SetTaskDateBody,
  TaskRevisionBody,
  UpdateThreadBody,
  ThreadIdSchema,
  TaskIdSchema,
} from "./requests";

const TaskSchema = Schema.Struct({
  _id: TaskIdSchema,
  text: Schema.String,
  date: Schema.optionalKey(Timestamp),
});

export const ThreadSchema = Schema.Struct({
  _id: ThreadIdSchema,
  title: Schema.String,
  slug: Schema.String,
  summary: Schema.optionalKey(Schema.String),
  areaId: Schema.optionalKey(AreaIdSchema),
  order: Timestamp,
  state: Schema.Literals(["open", "resolved"]),
  tasks: Schema.optionalKey(Schema.Array(TaskSchema)),
  focusedTaskId: Schema.optionalKey(TaskIdSchema),
  // Compatibility (ADR 0033, removal in #402): the old names for the two
  // fields above, with the same values.
  moves: Schema.optionalKey(Schema.Array(TaskSchema)),
  focusedMoveId: Schema.optionalKey(TaskIdSchema),
  // Compatibility (ADR 0032, removal in #402): derived from the soonest dated
  // Task; never stored.
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
const TaskParams = { threadId: ThreadIdSchema, taskId: TaskIdSchema };
// Compatibility (ADR 0033, removal in #402): the `/moves` routes name the same
// Tasks in the path as `:moveId`.
const MoveParams = { threadId: ThreadIdSchema, moveId: TaskIdSchema };

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
    HttpApiEndpoint.post("addTask", "/v1/threads/:threadId/tasks", {
      params: ThreadParams,
      payload: AddTaskBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.patch("editTask", "/v1/threads/:threadId/tasks/:taskId", {
      params: TaskParams,
      payload: EditTaskBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.delete(
      "removeTask",
      "/v1/threads/:threadId/tasks/:taskId",
      {
        params: TaskParams,
        payload: TaskRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.post(
      "completeTask",
      "/v1/threads/:threadId/tasks/:taskId/complete",
      {
        params: TaskParams,
        payload: TaskRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.put(
      "setTaskDate",
      "/v1/threads/:threadId/tasks/:taskId/date",
      {
        params: TaskParams,
        payload: SetTaskDateBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    // Focus has no Task in its path, so one route serves both spellings of the
    // body field.
    HttpApiEndpoint.put("focusTask", "/v1/threads/:threadId/focus", {
      params: ThreadParams,
      payload: FocusTaskBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
    // Compatibility (ADR 0033, removal in #402): the former `/moves` routes.
    HttpApiEndpoint.post("addMove", "/v1/threads/:threadId/moves", {
      params: ThreadParams,
      payload: AddMoveBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.patch("editMove", "/v1/threads/:threadId/moves/:moveId", {
      params: MoveParams,
      payload: EditTaskBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.delete(
      "removeMove",
      "/v1/threads/:threadId/moves/:moveId",
      {
        params: MoveParams,
        payload: TaskRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.post(
      "completeMove",
      "/v1/threads/:threadId/moves/:moveId/complete",
      {
        params: MoveParams,
        payload: TaskRevisionBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
