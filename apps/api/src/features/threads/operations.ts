import type {
  AddMoveInput,
  CommandAcknowledgement,
  CompleteMoveInput,
  CreateThreadInput,
  EditMoveInput,
  FocusMoveInput,
  OperationResult,
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

import type { RequestScope } from "../../platform/request-scope";
import type { ThreadChange } from "./storage";

import { changeConflict, failed, succeeded } from "../../platform/operation";
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

export async function listOpenThreads(
  scope: RequestScope,
): Promise<OperationResult<Thread[]>> {
  return succeeded(await threadStorage(scope).listOpen());
}

export async function listResolvedThreads(
  scope: RequestScope,
): Promise<OperationResult<Thread[]>> {
  return succeeded(await threadStorage(scope).listResolved());
}

export async function getThreadDetail(
  scope: RequestScope,
  input: { slug: string },
): Promise<OperationResult<ThreadDetail>> {
  const detail = await threadStorage(scope).findDetail(input.slug);
  return detail === null ? failed(threadNotFound) : succeeded(detail);
}

/**
 * A Thread needs only a title. When it is labeled at creation, the Area must be
 * one the owner holds, so the failure names the Area when it is not theirs.
 */
export async function createThread(
  scope: RequestScope,
  input: CreateThreadInput,
): Promise<OperationResult<Thread>> {
  const threads = threadStorage(scope);
  const title = requireNonBlankText(input.title, "Thread title");

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    try {
      const thread = await threads.insert({
        ...input,
        title,
        slug: generateSlug(title),
      });
      if (thread === null) return failed(areaNotFound);

      return succeeded(thread);
    } catch (error) {
      if (!isThreadSlugTaken(error)) throw error;
    }
  }

  return failed(changeConflict);
}

/**
 * One Thread edit: title, Summary, Area, Follow-up, or lifecycle.
 * The Activity Log the change earns is written with it or not at all.
 */
export async function updateThread(
  scope: RequestScope,
  { threadId, resolutionNote, ...requested }: UpdateThreadInput,
): Promise<OperationResult<Thread>> {
  const areas = areaStorage(scope);
  const title =
    requested.title === undefined
      ? undefined
      : requireNonBlankText(requested.title, "Thread title");

  return changeThread(scope, threadId, async (thread) => {
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
        const destination = await areas.find(patch.areaId);
        if (destination === null) return failed(areaNotFound);
        areaNames.to = destination.name;
      }
      if (thread.areaId !== undefined) {
        const origin = await areas.find(thread.areaId);
        if (origin !== null) areaNames.from = origin.name;
      }
    }

    return succeeded(
      decideThreadUpdate({
        thread,
        patch: { ...patch, ...rename },
        ...(resolutionNote === undefined ? {} : { resolutionNote }),
        areaNames,
      }),
    );
  });
}

/** A new Move joins the end of the Thread's Moves, unfocused. */
export async function addMove(
  scope: RequestScope,
  input: AddMoveInput,
): Promise<OperationResult<Thread>> {
  const move = {
    _id: requireMoveId(input.moveId),
    text: requireMoveText(input.text),
  };
  return changeMoves(scope, input, (thread) => decideAddMove(thread, move));
}

export async function editMove(
  scope: RequestScope,
  input: EditMoveInput,
): Promise<OperationResult<Thread>> {
  const text = requireMoveText(input.text);
  return changeMoves(scope, input, (thread) =>
    decideEditMove(thread, input.moveId, text),
  );
}

export async function removeMove(
  scope: RequestScope,
  input: RemoveMoveInput,
): Promise<OperationResult<Thread>> {
  return changeMoves(scope, input, (thread) =>
    decideRemoveMove(thread, input.moveId),
  );
}

/**
 * Complete one Move, focused or not. Its Activity Log entry is written with the
 * change or not at all, and two competing completions of the same Move record
 * one: the loser finds the revision moved on.
 */
export async function completeMove(
  scope: RequestScope,
  input: CompleteMoveInput,
): Promise<OperationResult<Thread>> {
  return changeMoves(scope, input, (thread) =>
    decideCompleteMove(thread, input.moveId),
  );
}

export async function focusMove(
  scope: RequestScope,
  input: FocusMoveInput,
): Promise<OperationResult<Thread>> {
  return changeMoves(scope, input, (thread) =>
    decideFocusMove(thread, input.moveId),
  );
}

export async function removeThread(
  scope: RequestScope,
  input: { threadId: ThreadId },
): Promise<OperationResult<CommandAcknowledgement>> {
  return (await threadStorage(scope).remove(input.threadId))
    ? succeeded(commandAcknowledged)
    : failed(threadNotFound);
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
async function changeMoves(
  scope: RequestScope,
  command: { threadId: ThreadId; expectedRevision: number },
  decide: (thread: Thread) => ThreadUpdateDecision | null,
): Promise<OperationResult<Thread>> {
  const threads = threadStorage(scope);
  const thread = await threads.find(command.threadId);
  if (thread === null) return failed(threadNotFound);
  if (thread.revision !== command.expectedRevision) {
    return failed(moveConflict);
  }

  const decision = decide(thread);
  if (decision === null) return failed(moveConflict);
  if (Object.keys(decision.patch).length === 0 && decision.logs.length === 0) {
    return succeeded(thread);
  }

  const written = await threads.writeChange({
    threadId: command.threadId,
    expectedRevision: command.expectedRevision,
    change: decision,
  });
  return written === null ? failed(moveConflict) : succeeded(written);
}

/**
 * Read the Thread, let a rule decide the change, and write it atomically.
 *
 * The write is conditional on the revision the decision was made against, so a
 * Thread that changed underneath is decided again from its new state rather
 * than overwritten with a stale conclusion.
 */
async function changeThread(
  scope: RequestScope,
  threadId: ThreadId,
  decide: (thread: Thread) => Promise<OperationResult<ThreadChange>>,
): Promise<OperationResult<Thread>> {
  const threads = threadStorage(scope);

  for (let attempt = 0; attempt < CHANGE_ATTEMPTS; attempt += 1) {
    const thread = await threads.find(threadId);
    if (thread === null) return failed(threadNotFound);

    const decision = await decide(thread);
    if (!decision.ok) return decision;

    const change = decision.value;
    if (Object.keys(change.patch).length === 0 && change.logs.length === 0) {
      return succeeded(thread);
    }

    try {
      const written = await threads.writeChange({
        threadId,
        expectedRevision: thread.revision,
        change,
      });
      if (written !== null) return succeeded(written);
    } catch (error) {
      if (!isThreadSlugTaken(error)) throw error;
    }
  }

  return failed(changeConflict);
}
