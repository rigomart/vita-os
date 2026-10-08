import {
  CreateThreadBody,
  EditTaskBody,
  FocusTaskBody,
  TaskIdSchema,
  ThreadIdSchema,
  UpdateThreadBody,
} from "@vita-os/contracts";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { respond } from "../../platform/http/errors";
import {
  addTask,
  completeTask,
  createThread,
  editTask,
  focusTask,
  getThreadDetail,
  listOpenThreads,
  listResolvedThreads,
  removeTask,
  removeThread,
  setTaskDate,
  setTaskRepeat,
  skipTask,
  updateThread,
} from "./operations";
import {
  AddTaskBody,
  CompleteTaskBody,
  SetTaskDateBody,
  SetTaskRepeatBody,
  SkipTaskBody,
  normalizeSetTaskRepeat,
  normalizeThreadChange,
} from "./requests";

const ThreadParams = v.object({ threadId: ThreadIdSchema });
const TaskParams = v.object({ ...ThreadParams.entries, taskId: TaskIdSchema });
export const threadsRoutes = new Hono<ApiEnv>()
  .get("/threads", async (c) => respond(await listOpenThreads(c.get("scope"))))
  .get("/threads/resolved", async (c) =>
    respond(await listResolvedThreads(c.get("scope"))),
  )
  .post(
    "/threads",
    validate("json", CreateThreadBody, "Invalid Thread."),
    async (c) =>
      respond(await createThread(c.get("scope"), c.req.valid("json")), 201),
  )
  .get(
    "/threads/:slug",
    validate("param", v.object({ slug: v.string() }), "Invalid request."),
    async (c) =>
      respond(await getThreadDetail(c.get("scope"), c.req.valid("param"))),
  )
  .patch(
    "/threads/:threadId",
    validate("param", ThreadParams, "Invalid Thread change."),
    validate("json", UpdateThreadBody, "Invalid Thread change."),
    async (c) =>
      respond(
        await updateThread(c.get("scope"), {
          ...c.req.valid("param"),
          ...normalizeThreadChange(c.req.valid("json")),
        }),
      ),
  )
  .delete(
    "/threads/:threadId",
    validate("param", ThreadParams, "Invalid request."),
    async (c) =>
      respond(await removeThread(c.get("scope"), c.req.valid("param"))),
  )
  .post(
    "/threads/:threadId/tasks",
    validate("param", ThreadParams, "Invalid Task change."),
    validate("json", AddTaskBody, "Invalid Task change."),
    async (c) =>
      respond(
        await addTask(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .patch(
    "/threads/:threadId/tasks/:taskId",
    validate("param", TaskParams, "Invalid Task change."),
    validate("json", EditTaskBody, "Invalid Task change."),
    async (c) =>
      respond(
        await editTask(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .delete(
    "/threads/:threadId/tasks/:taskId",
    validate("param", TaskParams, "Invalid Task change."),
    async (c) =>
      respond(await removeTask(c.get("scope"), c.req.valid("param"))),
  )
  .post(
    "/threads/:threadId/tasks/:taskId/complete",
    validate("param", TaskParams, "Invalid Task change."),
    validate("json", CompleteTaskBody, "Invalid Task change."),
    async (c) =>
      respond(
        await completeTask(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .put(
    "/threads/:threadId/tasks/:taskId/repeat",
    validate("param", TaskParams, "Invalid Task change."),
    validate("json", SetTaskRepeatBody, "Invalid Task change."),
    async (c) =>
      respond(
        await setTaskRepeat(c.get("scope"), {
          ...c.req.valid("param"),
          ...normalizeSetTaskRepeat(c.req.valid("json")),
        }),
      ),
  )
  .post(
    "/threads/:threadId/tasks/:taskId/skip",
    validate("param", TaskParams, "Invalid Task change."),
    validate("json", SkipTaskBody, "Invalid Task change."),
    async (c) =>
      respond(
        await skipTask(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .put(
    "/threads/:threadId/tasks/:taskId/date",
    validate("param", TaskParams, "Invalid Task change."),
    validate("json", SetTaskDateBody, "Invalid Task change."),
    async (c) =>
      respond(
        await setTaskDate(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .put(
    "/threads/:threadId/focus",
    validate("param", ThreadParams, "Invalid Task change."),
    validate("json", FocusTaskBody, "Invalid Task change."),
    async (c) =>
      respond(
        await focusTask(c.get("scope"), {
          ...c.req.valid("param"),
          ...c.req.valid("json"),
        }),
      ),
  );
