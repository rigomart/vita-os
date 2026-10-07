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
import { AreaSummarySchema } from "../areas/api";
import { AreaIdSchema } from "../areas/requests";
import {
  AddTaskBody,
  CreateThreadBody,
  EditTaskBody,
  FocusTaskBody,
  SetTaskDateBody,
  SetTaskRepeatBody,
  SkipTaskBody,
  CompleteTaskBody,
  RepeatSchema,
  UpdateThreadBody,
  ThreadIdSchema,
  TaskIdSchema,
} from "./requests";

const TaskSchema = Schema.Struct({
  _id: TaskIdSchema,
  text: Schema.String,
  date: Schema.optionalKey(Timestamp),
  repeat: Schema.optionalKey(RepeatSchema),
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
  lastActivityAt: Schema.optionalKey(Timestamp),
  lastActivityContent: Schema.optionalKey(Schema.String),
  createdAt: Timestamp,
});
export const ThreadDetailSchema = Schema.Struct({
  thread: ThreadSchema,
  area: Schema.optionalKey(AreaSummarySchema),
});
const ThreadParams = { threadId: ThreadIdSchema };
const TaskParams = { threadId: ThreadIdSchema, taskId: TaskIdSchema };

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
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.post(
      "completeTask",
      "/v1/threads/:threadId/tasks/:taskId/complete",
      {
        params: TaskParams,
        payload: CompleteTaskBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.put(
      "setTaskRepeat",
      "/v1/threads/:threadId/tasks/:taskId/repeat",
      {
        params: TaskParams,
        payload: SetTaskRepeatBody,
        success: ThreadSchema,
      },
    ).annotate(ValidationMessage, "Invalid Task change."),
    HttpApiEndpoint.post(
      "skipTask",
      "/v1/threads/:threadId/tasks/:taskId/skip",
      {
        params: TaskParams,
        payload: SkipTaskBody,
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
    HttpApiEndpoint.put("focusTask", "/v1/threads/:threadId/focus", {
      params: ThreadParams,
      payload: FocusTaskBody,
      success: ThreadSchema,
    }).annotate(ValidationMessage, "Invalid Task change."),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
