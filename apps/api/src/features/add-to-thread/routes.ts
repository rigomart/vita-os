import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import { addNoteToThread, createThreadFromNote } from "./operations";

export const AddToThreadHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "addToThread",
  (handlers) =>
    handlers
      .handle("addToThread", ({ params, payload }) =>
        addNoteToThread({ noteId: params.noteId, threadId: payload.threadId }),
      )
      .handle("newThread", ({ params, payload }) =>
        createThreadFromNote({
          noteId: params.noteId,
          title: payload.title,
          ...(payload.areaId === undefined ? {} : { areaId: payload.areaId }),
        }),
      ),
);
