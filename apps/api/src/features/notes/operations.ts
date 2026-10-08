import type {
  CommandAcknowledgement,
  DoneNotePageRequest,
  Note,
  NoteId,
  NotePage,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { noteSearchTerms, requireNonBlankText } from "@vita-os/core";
import { Result } from "better-result";

import type { NotFound } from "../../platform/failures";
import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { attempt, database } from "../../platform/operation";
import { noteNotFound } from "./errors";
import { noteStorage } from "./storage";

function found(note: Note | null): Result<Note, NotFound> {
  return note === null ? Result.err(noteNotFound()) : Result.ok(note);
}

export function listOpenNotes(scope: RequestScope): Operation<Note[]> {
  return database(() => noteStorage(scope).listOpen());
}

export function countOpenNotes(scope: RequestScope): Operation<number> {
  return database(() => noteStorage(scope).countOpen());
}

/** Archived Notes, newest archive first; `query` searches their bodies. */
export function getDoneNotePage(
  scope: RequestScope,
  input: DoneNotePageRequest,
): Operation<NotePage> {
  return Result.gen(async function* () {
    const { query, ...page } = input;
    const terms = yield* attempt(() => noteSearchTerms(query ?? ""));
    return await database(() => noteStorage(scope).readDonePage(page, terms));
  });
}

export function createNote(
  scope: RequestScope,
  input: {
    body: string;
    followUp?: number;
  },
): Operation<Note> {
  return Result.gen(async function* () {
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Note body"),
    );
    return found(
      yield* Result.await(
        database(() => noteStorage(scope).insert({ ...input, body })),
      ),
    );
  });
}

export function updateNoteBody(
  scope: RequestScope,
  input: {
    noteId: NoteId;
    body: string;
  },
): Operation<Note> {
  return Result.gen(async function* () {
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Note body"),
    );
    return found(
      yield* Result.await(
        database(() => noteStorage(scope).setBody(input.noteId, body)),
      ),
    );
  });
}

export function updateNoteFollowUp(
  scope: RequestScope,
  input: {
    noteId: NoteId;
    followUp: number | null;
  },
): Operation<Note> {
  return Result.gen(async function* () {
    return found(
      yield* Result.await(
        database(() =>
          noteStorage(scope).setFollowUp(input.noteId, input.followUp),
        ),
      ),
    );
  });
}

export function markNoteDone(
  scope: RequestScope,
  input: { noteId: NoteId },
): Operation<Note> {
  return Result.gen(async function* () {
    return found(
      yield* Result.await(
        database(() => noteStorage(scope).markDone(input.noteId)),
      ),
    );
  });
}

export function markNoteOpen(
  scope: RequestScope,
  input: { noteId: NoteId },
): Operation<Note> {
  return Result.gen(async function* () {
    return found(
      yield* Result.await(
        database(() => noteStorage(scope).markOpen(input.noteId)),
      ),
    );
  });
}

export function removeNote(
  scope: RequestScope,
  input: {
    noteId: NoteId;
  },
): Operation<CommandAcknowledgement> {
  return Result.gen(async function* () {
    const removed = yield* Result.await(
      database(() => noteStorage(scope).remove(input.noteId)),
    );
    return removed
      ? Result.ok(commandAcknowledged)
      : Result.err(noteNotFound());
  });
}
