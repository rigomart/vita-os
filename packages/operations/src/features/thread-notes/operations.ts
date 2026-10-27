import type {
  CommandAcknowledgement,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";
import { Result } from "better-result";

import type { NotFound } from "../../platform/failures";
import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { attempt, database } from "../../platform/operation";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { threadNoteNotFound } from "./errors";
import { threadNoteStorage } from "./storage";

// Reads are addressed through the Thread that owns them, which must be the
// caller's; a single Note is addressed by itself, because that is what the
// person is editing.

function found(note: ThreadNote | null): Result<ThreadNote, NotFound> {
  return note === null ? Result.err(threadNoteNotFound()) : Result.ok(note);
}

export function listThreadNotes(
  scope: RequestScope,
  input: {
    threadId: ThreadId;
  },
): Operation<ThreadNote[]> {
  return Result.gen(async function* () {
    if (
      !(yield* Result.await(
        database(() => threadStorage(scope).exists(input.threadId)),
      ))
    )
      return Result.err(threadNotFound());
    return Result.ok(
      yield* Result.await(
        database(() => threadNoteStorage(scope).list(input.threadId)),
      ),
    );
  });
}

export function createThreadNote(
  scope: RequestScope,
  input: {
    threadId: ThreadId;
    body: string;
  },
): Operation<ThreadNote> {
  return Result.gen(async function* () {
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Thread note body"),
    );
    const note = yield* Result.await(
      database(() => threadNoteStorage(scope).insert(input.threadId, body)),
    );
    return note === null ? Result.err(threadNotFound()) : Result.ok(note);
  });
}

export function updateThreadNoteBody(
  scope: RequestScope,
  input: {
    threadNoteId: ThreadNoteId;
    body: string;
  },
): Operation<ThreadNote> {
  return Result.gen(async function* () {
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Thread note body"),
    );
    return found(
      yield* Result.await(
        database(() =>
          threadNoteStorage(scope).setBody(input.threadNoteId, body),
        ),
      ),
    );
  });
}

export function removeThreadNote(
  scope: RequestScope,
  input: {
    threadNoteId: ThreadNoteId;
  },
): Operation<CommandAcknowledgement> {
  return Result.gen(async function* () {
    const removed = yield* Result.await(
      database(() => threadNoteStorage(scope).remove(input.threadNoteId)),
    );
    return removed
      ? Result.ok(commandAcknowledged)
      : Result.err(threadNoteNotFound());
  });
}
