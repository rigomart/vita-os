import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
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
import { normalizeSetTaskRepeat, normalizeThreadChange } from "./requests";

/** Threads and their Tasks. */
export const ThreadsHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "threads",
  (handlers) =>
    handlers
      .handle("listOpen", () => listOpenThreads())
      .handle("listResolved", () => listResolvedThreads())
      .handle("create", ({ payload }) =>
        createThread({
          title: payload.title,
          ...(payload.summary === undefined
            ? {}
            : { summary: payload.summary }),
          ...(payload.areaId === undefined ? {} : { areaId: payload.areaId }),
        }),
      )
      .handle("detail", ({ params }) => getThreadDetail({ slug: params.slug }))
      .handle("update", ({ params, payload }) =>
        updateThread({
          ...normalizeThreadChange(payload),
          threadId: params.threadId,
        }),
      )
      .handle("remove", ({ params }) =>
        removeThread({ threadId: params.threadId }),
      )
      .handle("addTask", ({ params, payload }) =>
        addTask({ ...payload, threadId: params.threadId }),
      )
      .handle("editTask", ({ params, payload }) =>
        editTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("removeTask", ({ params }) =>
        removeTask({
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("completeTask", ({ params, payload }) =>
        completeTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("setTaskDate", ({ params, payload }) =>
        setTaskDate({
          ...payload,
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("setTaskRepeat", ({ params, payload }) =>
        setTaskRepeat({
          ...normalizeSetTaskRepeat(payload),
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("skipTask", ({ params, payload }) =>
        skipTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("focusTask", ({ params, payload }) =>
        focusTask({
          ...payload,
          threadId: params.threadId,
        }),
      ),
);
