import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import { pageRequest } from "../../platform/http/schemas";
import {
  countOpenNotes,
  createNote,
  getDoneNotePage,
  listOpenNotes,
  markNoteDone,
  markNoteOpen,
  removeNote,
  updateNoteBody,
  updateNoteFollowUp,
} from "./operations";
import {
  normalizeCreateNote,
  normalizeNoteFollowUp,
  NOTE_PAGE_SIZE,
} from "./requests";

/**
 * Standalone Notes: the collection, its count, its Done history, and the four
 * ways one Note changes.
 */
export const NotesHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "notes",
  (handlers) =>
    handlers
      .handle("list", () => listOpenNotes())
      // The count travels wrapped, so the body is a JSON object like every other.
      .handle("openCount", () =>
        Effect.map(countOpenNotes(), (count) => ({ count })),
      )
      .handle("done", ({ query }) =>
        Effect.flatMap(pageRequest(query, NOTE_PAGE_SIZE), (page) =>
          getDoneNotePage({
            ...page,
            ...(query.q === undefined ? {} : { query: query.q }),
          }),
        ),
      )
      .handle("create", ({ payload }) =>
        createNote(normalizeCreateNote(payload)),
      )
      .handle("body", ({ params, payload }) =>
        updateNoteBody({ ...params, body: payload.body }),
      )
      .handle("followUp", ({ params, payload }) =>
        updateNoteFollowUp({ ...params, ...normalizeNoteFollowUp(payload) }),
      )
      .handle("attentionDate", ({ params, payload }) =>
        updateNoteFollowUp({ ...params, ...normalizeNoteFollowUp(payload) }),
      )
      .handle("state", ({ params, payload }) =>
        payload.state === "done" ? markNoteDone(params) : markNoteOpen(params),
      )
      .handle("remove", ({ params }) => removeNote(params)),
);
