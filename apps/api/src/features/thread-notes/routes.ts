import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import { pageRequest } from "../../platform/http/schemas";
import {
  createThreadNote,
  getDoneThreadNotePage,
  listOpenThreadNotes,
  markThreadNoteDone,
  markThreadNoteOpen,
  removeThreadNote,
  updateThreadNoteBody,
} from "./operations";

const NOTE_PAGE_SIZE = { fallback: 20, maximum: 50 };
/** Notes captured inside one Thread. */
export const ThreadNotesHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "threadNotes",
  (handlers) =>
    handlers
      .handle("listOpen", ({ params }) =>
        listOpenThreadNotes({ threadId: params.threadId }),
      )
      .handle("donePage", ({ params, query }) =>
        Effect.gen(function* () {
          const page = yield* pageRequest(query, NOTE_PAGE_SIZE);
          return yield* getDoneThreadNotePage({
            threadId: params.threadId,
            ...page,
          });
        }),
      )
      .handle("create", ({ params, payload }) =>
        createThreadNote({ threadId: params.threadId, body: payload.body }),
      )
      .handle("updateBody", ({ params, payload }) =>
        updateThreadNoteBody({
          threadNoteId: params.threadNoteId,
          body: payload.body,
        }),
      )
      .handle("setState", ({ params, payload }) => {
        const target = { threadNoteId: params.threadNoteId };
        return payload.state === "done"
          ? markThreadNoteDone(target)
          : markThreadNoteOpen(target);
      })
      .handle("remove", ({ params }) =>
        removeThreadNote({ threadNoteId: params.threadNoteId }),
      ),
);
