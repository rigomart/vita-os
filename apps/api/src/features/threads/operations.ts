import type {
  AddMoveInput,
  CommandAcknowledgement,
  CompleteMoveInput,
  CreateThreadInput,
  EditMoveInput,
  FocusMoveInput,
  RemoveMoveInput,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { ThreadPatch, ThreadUpdateDecision } from "@vita-os/core";

import { commandAcknowledged } from "@vita-os/contracts";
import {
  clearedToAbsent,
  decideAddMove,
  decideCompleteMove,
  decideEditMove,
  decideFocusMove,
  decideRemoveMove,
  decideThreadUpdate,
  generateSlug,
  requireMoveId,
  requireMoveText,
  requireNonBlankText,
} from "@vita-os/core";
import { Effect } from "effect";

import type { OperationFailure } from "../../platform/failures";
import type { Operation } from "../../platform/operation";
import type { ThreadChange } from "./storage";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { moveConflict, threadNotFound } from "./errors";
import { isThreadSlugTaken, threadStorage } from "./storage";

/**
 * How many times a Thread change re-reads and re-decides after losing a
 * revision race.
 *
 * An ordinary edit should not fail because somebody else wrote first, so a lost
 * race is retried from the fresh Thread instead of surfacing a conflict. Only a
 * caller that supplied its own expectation — every Move command — is told
 * about the conflict, because for that caller a retry could act on a different
 * Move.
 */
const CHANGE_ATTEMPTS = 3;

/** How many times a create re-mints a colliding slug. */
const SLUG_ATTEMPTS = 3;

export function listOpenThreads(): Operation<Thread[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => threadStorage(scope).listOpen());
  });
}

export function listResolvedThreads(): Operation<Thread[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => threadStorage(scope).listResolved());
  });
}

export function getThreadDetail(input: {
  slug: string;
}): Operation<ThreadDetail> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const detail = yield* database(() =>
      threadStorage(scope).findDetail(input.slug),
    );
    return detail === null ? yield* threadNotFound() : detail;
  });
}

/**
 * A Thread needs only a title. When it is labeled at creation, the Area must be
 * one the owner holds, so the failure names the Area when it is not theirs.
 */
export function createThread(input: CreateThreadInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );

    for (let execution = 0; execution < SLUG_ATTEMPTS; execution += 1) {
      const thread = yield* database(
        () => threads.insert({ ...input, title, slug: generateSlug(title) }),
        isThreadSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(undefined)));
      if (thread === undefined) continue;
      return thread === null ? yield* areaNotFound() : thread;
    }
    return yield* new ChangeConflict();
  });
}

/**
 * One Thread edit: title, Summary, Area, Follow-up, or lifecycle.
 * The Activity Log the change earns is written with it or not at all.
 */
export function updateThread({
  threadId,
  resolutionNote,
  ...requested
}: UpdateThreadInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    const title =
      requested.title === undefined
        ? undefined
        : yield* attempt(() =>
            requireNonBlankText(requested.title!, "Thread title"),
          );

    return yield* changeThread(threadId, (thread) =>
      Effect.gen(function* () {
        const patch: ThreadPatch = clearedToAbsent({
          ...requested,
          ...(title === undefined ? {} : { title }),
        });
        // A retitled Thread gets a new slug; the old one stops resolving.
        const rename =
          title !== undefined && title !== thread.title
            ? { slug: generateSlug(title) }
            : {};

        // Naming the ends of a label change is what lets the Activity Log say
        // where the Thread came from and went. An Area that is not the owner's
        // stops the change here.
        const areaNames: { from?: string; to?: string } = {};
        if (Object.hasOwn(patch, "areaId") && patch.areaId !== thread.areaId) {
          if (patch.areaId !== undefined) {
            const destination = yield* database(() =>
              areas.find(patch.areaId!),
            );
            if (destination === null) return yield* areaNotFound();
            areaNames.to = destination.name;
          }
          if (thread.areaId !== undefined) {
            const origin = yield* database(() => areas.find(thread.areaId!));
            if (origin !== null) areaNames.from = origin.name;
          }
        }

        return decideThreadUpdate({
          thread,
          patch: { ...patch, ...rename },
          ...(resolutionNote === undefined ? {} : { resolutionNote }),
          areaNames,
        });
      }),
    );
  });
}

/** A new Move joins the end of the Thread's Moves, unfocused. */
export function addMove(input: AddMoveInput): Operation<Thread> {
  return Effect.gen(function* () {
    const move = yield* attempt(() => ({
      _id: requireMoveId(input.moveId),
      text: requireMoveText(input.text),
    }));
    return yield* changeMoves(input, (thread) => decideAddMove(thread, move));
  });
}

export function editMove(input: EditMoveInput): Operation<Thread> {
  return Effect.gen(function* () {
    const text = yield* attempt(() => requireMoveText(input.text));
    return yield* changeMoves(input, (thread) =>
      decideEditMove(thread, input.moveId, text),
    );
  });
}

export function removeMove(input: RemoveMoveInput): Operation<Thread> {
  return changeMoves(input, (thread) => decideRemoveMove(thread, input.moveId));
}

/**
 * Complete one Move, focused or not. Its Activity Log entry is written with the
 * change or not at all, and two competing completions of the same Move record
 * one: the loser finds the revision moved on.
 */
export function completeMove(input: CompleteMoveInput): Operation<Thread> {
  return changeMoves(input, (thread) =>
    decideCompleteMove(thread, input.moveId),
  );
}

export function focusMove(input: FocusMoveInput): Operation<Thread> {
  return changeMoves(input, (thread) => decideFocusMove(thread, input.moveId));
}

export function removeThread(input: {
  threadId: ThreadId;
}): Operation<CommandAcknowledgement> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      threadStorage(scope).remove(input.threadId),
    );
    return removed ? commandAcknowledged : yield* threadNotFound();
  });
}

/**
 * One Move command, decided against the Thread the caller read.
 *
 * The caller's revision must be the Thread's, and the Move it names must still
 * be there; otherwise the command is a conflict and nothing is written. The
 * write is conditional on the same revision, so a command that loses a race
 * after the check is refused too — never retried, since a retry could land on
 * a different Move.
 */
function changeMoves(
  command: { threadId: ThreadId; expectedRevision: number },
  decide: (thread: Thread) => ThreadUpdateDecision | null,
): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    const thread = yield* database(() => threads.find(command.threadId));
    if (thread === null) return yield* threadNotFound();
    if (thread.revision !== command.expectedRevision) {
      return yield* moveConflict();
    }

    const decision = yield* attempt(() => decide(thread));
    if (decision === null) return yield* moveConflict();
    if (
      Object.keys(decision.patch).length === 0 &&
      decision.logs.length === 0
    ) {
      return thread;
    }

    const written = yield* database(() =>
      threads.writeChange({
        threadId: command.threadId,
        expectedRevision: command.expectedRevision,
        change: decision,
      }),
    );
    return written === null ? yield* moveConflict() : written;
  });
}

/**
 * Read the Thread, let a rule decide the change, and write it atomically.
 *
 * The write is conditional on the revision the decision was made against, so a
 * Thread that changed underneath is decided again from its new state rather
 * than overwritten with a stale conclusion.
 */
function changeThread(
  threadId: ThreadId,
  decide: (thread: Thread) => Effect.Effect<ThreadChange, OperationFailure>,
): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);

    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const thread = yield* database(() => threads.find(threadId));
      if (thread === null) return yield* threadNotFound();

      const change = yield* decide(thread);
      if (Object.keys(change.patch).length === 0 && change.logs.length === 0) {
        return thread;
      }

      const written = yield* database(
        () =>
          threads.writeChange({
            threadId,
            expectedRevision: thread.revision,
            change,
          }),
        isThreadSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(null)));
      if (written !== null) return written;
    }
    return yield* new ChangeConflict();
  });
}
