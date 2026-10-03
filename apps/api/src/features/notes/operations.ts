import type {
  CommandAcknowledgement,
  DoneNotePageRequest,
  Note,
  NoteId,
  NotePage,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { noteSearchTerms, requireNonBlankText } from "@vita-os/core";
import { Effect } from "effect";

import type { RequestRefusal } from "../../platform/http/errors";

import { attempt, database, failed, succeeded } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { noteNotFound } from "./errors";
import { noteStorage } from "./storage";

function found(note: Note | null): Effect.Effect<Note, RequestRefusal> {
  return note === null ? failed(noteNotFound) : succeeded(note);
}

export function listOpenNotes(): Effect.Effect<
  Note[],
  RequestRefusal,
  RequestContext
> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => noteStorage(scope).listOpen());
  });
}

export function countOpenNotes(): Effect.Effect<
  number,
  RequestRefusal,
  RequestContext
> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => noteStorage(scope).countOpen());
  });
}

/** Archived Notes, newest archive first; `query` searches their bodies. */
export function getDoneNotePage(
  input: DoneNotePageRequest,
): Effect.Effect<NotePage, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const { query, ...page } = input;
    const terms = yield* attempt(() => noteSearchTerms(query ?? ""));
    return yield* database(() => noteStorage(scope).readDonePage(page, terms));
  });
}

export function createNote(input: {
  body: string;
  followUp?: number;
}): Effect.Effect<Note, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Note body"),
    );
    return yield* found(
      yield* database(() => noteStorage(scope).insert({ ...input, body })),
    );
  });
}

export function updateNoteBody(input: {
  noteId: NoteId;
  body: string;
}): Effect.Effect<Note, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Note body"),
    );
    return yield* found(
      yield* database(() => noteStorage(scope).setBody(input.noteId, body)),
    );
  });
}

export function updateNoteFollowUp(input: {
  noteId: NoteId;
  followUp: number | null;
}): Effect.Effect<Note, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* found(
      yield* database(() =>
        noteStorage(scope).setFollowUp(input.noteId, input.followUp),
      ),
    );
  });
}

export function markNoteDone(input: {
  noteId: NoteId;
}): Effect.Effect<Note, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* found(
      yield* database(() => noteStorage(scope).markDone(input.noteId)),
    );
  });
}

export function markNoteOpen(input: {
  noteId: NoteId;
}): Effect.Effect<Note, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* found(
      yield* database(() => noteStorage(scope).markOpen(input.noteId)),
    );
  });
}

export function removeNote(input: {
  noteId: NoteId;
}): Effect.Effect<CommandAcknowledgement, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      noteStorage(scope).remove(input.noteId),
    );
    return yield* removed
      ? succeeded(commandAcknowledged)
      : failed(noteNotFound);
  });
}
