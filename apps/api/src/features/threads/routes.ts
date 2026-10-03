import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import {
  addMove,
  completeMove,
  createThread,
  editMove,
  focusMove,
  getThreadDetail,
  listOpenThreads,
  listResolvedThreads,
  removeMove,
  removeThread,
  updateThread,
} from "./operations";
import { normalizeThreadChange } from "./requests";

/** Threads and their Moves. */
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
      .handle("addMove", ({ params, payload }) =>
        addMove({
          ...payload,
          threadId: params.threadId,
          moveId: payload.moveId,
        }),
      )
      .handle("editMove", ({ params, payload }) =>
        editMove({
          ...payload,
          threadId: params.threadId,
          moveId: params.moveId,
        }),
      )
      .handle("removeMove", ({ params, payload }) =>
        removeMove({
          ...payload,
          threadId: params.threadId,
          moveId: params.moveId,
        }),
      )
      .handle("completeMove", ({ params, payload }) =>
        completeMove({
          ...payload,
          threadId: params.threadId,
          moveId: params.moveId,
        }),
      )
      .handle("focusMove", ({ params, payload }) =>
        focusMove({
          ...payload,
          threadId: params.threadId,
          moveId: payload.moveId,
        }),
      ),
);
