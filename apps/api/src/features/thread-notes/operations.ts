import type {
  CommandAcknowledgement,
  PageRequest,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";
import { Effect } from "effect";

import type { RequestRefusal } from "../../platform/http/errors";

import { attempt, database, failed } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { threadNoteNotFound } from "./errors";
import { threadNoteStorage } from "./storage";

type Operation<A> = Effect.Effect<A, RequestRefusal, RequestContext>;
function found(
  note: ThreadNote | null,
): Effect.Effect<ThreadNote, RequestRefusal> {
  return note === null ? failed(threadNoteNotFound) : Effect.succeed(note);
}

export function listOpenThreadNotes(input: {
  threadId: ThreadId;
}): Operation<ThreadNote[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    if (!(yield* database(() => threadStorage(scope).exists(input.threadId))))
      return yield* failed(threadNotFound);
    return yield* database(() =>
      threadNoteStorage(scope).listOpen(input.threadId),
    );
  });
}

export function getDoneThreadNotePage({
  threadId,
  ...page
}: { threadId: ThreadId } & PageRequest): Operation<ThreadNotePage> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    if (!(yield* database(() => threadStorage(scope).exists(threadId))))
      return yield* failed(threadNotFound);
    return yield* database(() =>
      threadNoteStorage(scope).readDonePage(threadId, page),
    );
  });
}

export function createThreadNote(input: {
  threadId: ThreadId;
  body: string;
}): Operation<ThreadNote> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Thread note body"),
    );
    const note = yield* database(() =>
      threadNoteStorage(scope).insert(input.threadId, body),
    );
    return note === null ? yield* failed(threadNotFound) : note;
  });
}

export function updateThreadNoteBody(input: {
  threadNoteId: ThreadNoteId;
  body: string;
}): Operation<ThreadNote> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const body = yield* attempt(() =>
      requireNonBlankText(input.body, "Thread note body"),
    );
    return yield* found(
      yield* database(() =>
        threadNoteStorage(scope).setBody(input.threadNoteId, body),
      ),
    );
  });
}

export function markThreadNoteDone(input: {
  threadNoteId: ThreadNoteId;
}): Operation<ThreadNote> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* found(
      yield* database(() =>
        threadNoteStorage(scope).markDone(input.threadNoteId),
      ),
    );
  });
}

export function markThreadNoteOpen(input: {
  threadNoteId: ThreadNoteId;
}): Operation<ThreadNote> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* found(
      yield* database(() =>
        threadNoteStorage(scope).markOpen(input.threadNoteId),
      ),
    );
  });
}

export function removeThreadNote(input: {
  threadNoteId: ThreadNoteId;
}): Operation<CommandAcknowledgement> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      threadNoteStorage(scope).remove(input.threadNoteId),
    );
    return removed ? commandAcknowledged : yield* failed(threadNoteNotFound);
  });
}
