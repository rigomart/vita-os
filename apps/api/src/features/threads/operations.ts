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

import type { RequestRefusal } from "../../platform/http/errors";
import type { ThreadChange } from "./storage";

import {
  attempt,
  changeConflict,
  database,
  failed,
} from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { moveConflict, threadNotFound } from "./errors";
import { isThreadSlugTaken, threadStorage } from "./storage";

/** Ordinary Thread edits re-read after a lost race; Move expectations never retry. */
const CHANGE_ATTEMPTS = 3;
/** Only a collision of the owner's slug permits a newly minted slug. */
const SLUG_ATTEMPTS = 3;
type Operation<A> = Effect.Effect<A, RequestRefusal, RequestContext>;

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
    return detail === null ? yield* failed(threadNotFound) : detail;
  });
}

export function createThread(input: CreateThreadInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );
    for (let execution = 0; execution < SLUG_ATTEMPTS; execution += 1) {
      const slug = yield* attempt(() => generateSlug(title));
      const inserted = yield* database(() =>
        threads.insert({ ...input, title, slug }),
      ).pipe(
        Effect.map((thread) => ({ kind: "written" as const, thread })),
        Effect.catch((error) =>
          isThreadSlugTaken(error.cause)
            ? Effect.succeed({ kind: "collision" as const })
            : Effect.fail(error),
        ),
      );
      if (inserted.kind === "written") {
        return inserted.thread === null
          ? yield* failed(areaNotFound)
          : inserted.thread;
      }
    }
    return yield* failed(changeConflict);
  });
}

/** The patch and the Activity Log it earns remain one native D1 batch. */
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
        const rename =
          title !== undefined && title !== thread.title
            ? { slug: yield* attempt(() => generateSlug(title)) }
            : {};
        const areaNames: { from?: string; to?: string } = {};
        if (Object.hasOwn(patch, "areaId") && patch.areaId !== thread.areaId) {
          if (patch.areaId !== undefined) {
            const destination = yield* database(() =>
              areas.find(patch.areaId!),
            );
            if (destination === null) return yield* failed(areaNotFound);
            areaNames.to = destination.name;
          }
          if (thread.areaId !== undefined) {
            const origin = yield* database(() => areas.find(thread.areaId!));
            if (origin !== null) areaNames.from = origin.name;
          }
        }
        return yield* attempt(() =>
          decideThreadUpdate({
            thread,
            patch: { ...patch, ...rename },
            ...(resolutionNote === undefined ? {} : { resolutionNote }),
            areaNames,
          }),
        );
      }),
    );
  });
}

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
    return removed ? commandAcknowledged : yield* failed(threadNotFound);
  });
}

/** A Move command is decided and conditionally written against the caller's revision. */
function changeMoves(
  command: { threadId: ThreadId; expectedRevision: number },
  decide: (thread: Thread) => ThreadUpdateDecision | null,
): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    const thread = yield* database(() => threads.find(command.threadId));
    if (thread === null) return yield* failed(threadNotFound);
    if (thread.revision !== command.expectedRevision)
      return yield* failed(moveConflict);
    const decision = yield* attempt(() => decide(thread));
    if (decision === null) return yield* failed(moveConflict);
    if (Object.keys(decision.patch).length === 0 && decision.logs.length === 0)
      return thread;
    const written = yield* database(() =>
      threads.writeChange({
        threadId: command.threadId,
        expectedRevision: command.expectedRevision,
        change: decision,
      }),
    );
    return written === null ? yield* failed(moveConflict) : written;
  });
}

/** Re-run the entire read and decision only for a revision race or slug collision. */
function changeThread(
  threadId: ThreadId,
  decide: (thread: Thread) => Effect.Effect<ThreadChange, RequestRefusal>,
): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const thread = yield* database(() => threads.find(threadId));
      if (thread === null) return yield* failed(threadNotFound);
      const change = yield* decide(thread);
      if (Object.keys(change.patch).length === 0 && change.logs.length === 0)
        return thread;
      const written = yield* database(() =>
        threads.writeChange({
          threadId,
          expectedRevision: thread.revision,
          change,
        }),
      ).pipe(
        Effect.catch((error) =>
          isThreadSlugTaken(error.cause)
            ? Effect.succeed(null)
            : Effect.fail(error),
        ),
      );
      if (written !== null) return written;
    }
    return yield* failed(changeConflict);
  });
}
