import type {
  CommandAcknowledgement,
  CompleteNextMoveInput,
  CompleteNextMoveOutput,
  CreateThreadInput,
  OperationResult,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { ThreadPatch } from "@vita-os/core";

import { commandAcknowledged } from "@vita-os/contracts";
import {
  clearedToAbsent,
  decideNextMoveCompletion,
  decideThreadUpdate,
  generateSlug,
  requireNonBlankText,
  requireOpenForUpNext,
  requireUpNextMoves,
  storedUpNext,
} from "@vita-os/core";

import type { RequestScope } from "../../platform/request-scope";
import type { ThreadChange } from "./storage";

import { changeConflict, failed, succeeded } from "../../platform/operation";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { nextMoveConflict, threadNotFound } from "./errors";
import { isThreadSlugTaken, threadStorage } from "./storage";

/**
 * How many times a Thread change re-reads and re-decides after losing a
 * revision race.
 *
 * An ordinary edit should not fail because somebody else wrote first, so a lost
 * race is retried from the fresh Thread instead of surfacing a conflict. Only a
 * caller that supplied its own expectation — Next Move completion — is told
 * about the conflict, because for that caller a retry could complete a
 * different move.
 */
const CHANGE_ATTEMPTS = 3;

/** How many times a create re-mints a colliding slug. */
const SLUG_ATTEMPTS = 3;

export async function listOpenThreads(
  scope: RequestScope,
): Promise<OperationResult<Thread[]>> {
  return succeeded(await threadStorage(scope).listOpen());
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
 * One Thread edit: title, Summary, Area, Next Move, Follow-up, or lifecycle.
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

/**
 * Rewrite the Up Next line — adding, editing, reordering and removing all
 * arrive as the new list, in order.
 *
 * Editing Up Next is silent: no Activity Log entry is written. The one
 * exception is the invariant — a list handed to a Thread with an empty Next
 * Move slot promotes its front move, and a Next Move always logs.
 */
export async function replaceUpNext(
  scope: RequestScope,
  input: { threadId: ThreadId; moves: string[] },
): Promise<OperationResult<Thread>> {
  const moves = requireUpNextMoves(input.moves);

  return changeThread(scope, input.threadId, async (thread) => {
    requireOpenForUpNext(thread);

    return succeeded(
      decideThreadUpdate({ thread, patch: { upNext: storedUpNext(moves) } }),
    );
  });
}

/**
 * Complete the Next Move, and — when Up Next holds moves — hand the slot
 * straight to the front one.
 *
 * The caller supplies the Next Move it read and the revision it read it at, so
 * a repeated request cannot complete a promoted move whose text happens to
 * match the one already completed. The write is conditional on both.
 */
export async function completeNextMove(
  scope: RequestScope,
  input: CompleteNextMoveInput,
): Promise<OperationResult<CompleteNextMoveOutput>> {
  const threads = threadStorage(scope);
  const thread = await threads.find(input.threadId);
  if (thread === null) return failed(threadNotFound);

  if (
    (thread.nextMove ?? null) !== input.expectedNextMove ||
    thread.revision !== input.expectedRevision
  ) {
    return failed(nextMoveConflict);
  }

  const decision = decideNextMoveCompletion({
    ...(thread.nextMove === undefined ? {} : { nextMove: thread.nextMove }),
    ...(thread.upNext === undefined ? {} : { upNext: thread.upNext }),
  });
  if (decision.status === "unchanged")
    return succeeded({ status: "unchanged" });

  const written = await threads.writeChange({
    threadId: input.threadId,
    expectedRevision: input.expectedRevision,
    expectedNextMove: input.expectedNextMove,
    change: { patch: decision.patch, logs: [decision.activity] },
  });
  if (written === null) return failed(nextMoveConflict);

  return succeeded({ status: "completed" });
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
