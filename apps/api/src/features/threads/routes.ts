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
  refuseThreadFollowUp,
  removeThread,
  setTaskDate,
  updateThread,
} from "./operations";
import {
  normalizeAddTask,
  normalizeFocusTask,
  normalizeThreadChange,
} from "./requests";

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
        // Compatibility (ADR 0032, removal in #402): nothing is written for a
        // request that sets a Thread's Follow-up date.
        Object.hasOwn(payload, "followUp")
          ? refuseThreadFollowUp()
          : updateThread({
              ...normalizeThreadChange(payload),
              threadId: params.threadId,
            }),
      )
      .handle("remove", ({ params }) =>
        removeThread({ threadId: params.threadId }),
      )
      .handle("addTask", ({ params, payload }) =>
        addTask({ ...normalizeAddTask(payload), threadId: params.threadId }),
      )
      .handle("editTask", ({ params, payload }) =>
        editTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.taskId,
        }),
      )
      .handle("removeTask", ({ params, payload }) =>
        removeTask({
          ...payload,
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
      .handle("focusTask", ({ params, payload }) =>
        focusTask({
          ...normalizeFocusTask(payload),
          threadId: params.threadId,
        }),
      )
      // Compatibility (ADR 0033, removal in #402): the former `/moves` routes
      // run the same operations.
      .handle("addMove", ({ params, payload }) =>
        addTask({ ...normalizeAddTask(payload), threadId: params.threadId }),
      )
      .handle("editMove", ({ params, payload }) =>
        editTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.moveId,
        }),
      )
      .handle("removeMove", ({ params, payload }) =>
        removeTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.moveId,
        }),
      )
      .handle("completeMove", ({ params, payload }) =>
        completeTask({
          ...payload,
          threadId: params.threadId,
          taskId: params.moveId,
        }),
      ),
);
