import type {
  CommandAcknowledgement,
  CompleteNoteInput,
  DoneNotePageRequest,
  Note,
  NoteId,
  NotePage,
  SetNoteRepeatInput,
  UpdateNoteFollowUpInput,
} from "@vita-os/contracts";
import type { NoteRepeatState } from "@vita-os/core";

import { commandAcknowledged } from "@vita-os/contracts";
import {
  decideCompleteNote,
  decideSetNoteFollowUp,
  decideSetNoteRepeat,
  noteSearchTerms,
  requireNonBlankText,
  requireTaskDate,
} from "@vita-os/core";
import { Result } from "better-result";

import type { NotFound, OperationFailure } from "../../platform/failures";
import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { requirePageLimit, type PageSize } from "../../platform/page-size";
import { noteNotFound, noteOccurrenceChanged } from "./errors";
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

/** Done Notes only grow, so both kinds of Note page them at this size. */
export const NOTE_PAGE_SIZE: PageSize = { fallback: 20, maximum: 50 };

/** Archived Notes, newest archive first; `query` searches their bodies. */
export function getDoneNotePage(
  scope: RequestScope,
  input: DoneNotePageRequest,
): Operation<NotePage> {
  return Result.gen(async function* () {
    const { query, ...page } = input;
    yield* requirePageLimit(page.limit, NOTE_PAGE_SIZE);
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
    if (input.followUp !== undefined) {
      const followUp = input.followUp;
      yield* attempt(() => requireTaskDate(followUp));
    }
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

/** Set, change or clear the date; clearing it clears the Repeat too. */
export function updateNoteFollowUp(
  scope: RequestScope,
  input: UpdateNoteFollowUpInput,
): Operation<Note> {
  return scheduleNote(scope, input.noteId, (note) =>
    attempt(() => decideSetNoteFollowUp(note, input.followUp, input.timeZone)),
  );
}

export function setNoteRepeat(
  scope: RequestScope,
  input: SetNoteRepeatInput,
): Operation<Note> {
  return scheduleNote(scope, input.noteId, (note) =>
    attempt(() => decideSetNoteRepeat(note, input.repeat, input.timeZone)),
  );
}

/**
 * Move a repeating Note to its next occurrence. Nothing is recorded. Two
 * competing completions advance it once: the loser finds the occurrence
 * changed.
 */
export function completeNote(
  scope: RequestScope,
  input: CompleteNoteInput,
): Operation<Note> {
  return scheduleNote(scope, input.noteId, (note) => {
    if (note.state !== "open") return Result.err(noteNotFound());
    if (note.repeat !== undefined && note.followUp !== input.expectedOccurrence)
      return Result.err(noteOccurrenceChanged());
    return attempt(() =>
      decideCompleteNote(note, {
        timeZone: input.timeZone,
        now: scope.clock.now(),
      }),
    );
  });
}

/** The same limit as other conditional changes. */
const CHANGE_ATTEMPTS = 3;

/**
 * Read the Note, let a rule decide its date and Repeat, and write both only
 * while the Note still holds what the rule read. A Note that changed
 * underneath is decided again from its new state.
 */
function scheduleNote(
  scope: RequestScope,
  noteId: NoteId,
  decide: (note: Note) => Result<NoteRepeatState, OperationFailure>,
): Operation<Note> {
  return Result.gen(async function* () {
    const notes = noteStorage(scope);
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const note = yield* Result.await(database(() => notes.find(noteId)));
      if (note === null) return Result.err(noteNotFound());
      const next = yield* decide(note);
      const written = yield* Result.await(
        database(() => notes.schedule(note, next)),
      );
      if (written !== null) return Result.ok(written);
    }
    return Result.err(new ChangeConflict());
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
