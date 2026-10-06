import type { QueryClient } from "@tanstack/react-query";
import type { Note, TaskId, Thread, ThreadId } from "@vita-os/contracts";

import { useMutationState } from "@tanstack/react-query";
import { useMemo } from "react";

import { queueMemo } from "../cache/use-application-mutation";

/** The queue every Task command of one Thread shares. */
export function taskScope(threadId: ThreadId): string {
  return `thread-tasks:${threadId}`;
}

/**
 * The ID of the Task a dated Note becomes. The caller mints Task IDs (ADR 0022),
 * and a Note converts once, so the Note's own ID names it: the same ID is shown
 * before the service answers, survives a replay, and is the one sent.
 */
export function noteTaskId(note: Pick<Note, "_id">): TaskId {
  return `note-task-${note._id}` as TaskId;
}

/** Marks the commands that turn a Note into a Task, so the Task can show it is pending. */
export const noteConversionKey = ["note-conversion"] as const;

/**
 * Per Thread, what settles once the last request handed to its line has been
 * answered. A Thread with nothing in line (a deleted one included) has none.
 */
const lines = new WeakMap<QueryClient, Map<ThreadId, Promise<unknown>>>();

/**
 * Hand one request for this Thread to the service once every request before
 * it has been answered: Task commands and Note conversions alike. A
 * conversion carries no revision but moves the Thread's, so a Task command
 * sent beside it would carry a revision already gone. Only the request waits
 * its turn — a conversion's Undo window is spent before it joins the line,
 * so the Thread's other Tasks stay usable meanwhile. `send` notes its answer
 * (`noteAnswer`) before it returns, so the next request reads it.
 */
export function sendInTurn<T>(
  cache: QueryClient,
  threadId: ThreadId,
  send: () => Promise<T>,
): Promise<T> {
  const byThread = lines.get(cache) ?? new Map<ThreadId, Promise<unknown>>();
  lines.set(cache, byThread);
  const turn = (byThread.get(threadId) ?? Promise.resolve()).then(send);
  const tail: Promise<unknown> = turn.then(
    () => undefined,
    () => undefined,
  );
  byThread.set(threadId, tail);
  void tail.then(() => {
    // Nothing joined the line behind this request: it is idle.
    if (byThread.get(threadId) === tail) byThread.delete(threadId);
  });
  return turn;
}

/**
 * What the service answered for this Thread, folded in only if it is newer
 * than what is already known: an answer never takes the queue backwards.
 *
 * A Task command's answer starts the queue's basis when it has none. A
 * conversion's answer only advances a basis that exists: with no Task command
 * queued, nothing should be remembered for later, and the next command starts
 * from the reads, as the head of a fresh queue does.
 */
export function noteAnswer(
  cache: QueryClient,
  settled: Thread,
  options: { startsBasis: boolean },
): void {
  const memo = queueMemo(cache);
  if (memo === undefined) return;
  const scope = taskScope(settled._id);
  memo.set(
    answeredKey(scope),
    Math.max(answeredRevision(cache, settled._id), settled.revision),
  );
  const basis = memo.get(scope) as Thread | undefined;
  if (
    basis === undefined
      ? options.startsBasis
      : settled.revision > basis.revision
  ) {
    memo.set(scope, settled);
  }
}

/** The Thread as this Thread's queue last heard it from the service, if it has. */
export function queueBasis(
  cache: QueryClient,
  threadId: ThreadId,
): Thread | undefined {
  return queueMemo(cache)?.get(taskScope(threadId)) as Thread | undefined;
}

const answeredKey = (scope: string) => `${scope}:answered`;

/**
 * The newest revision an answer for this Thread brought back while its
 * command is still pending. Reads are patched only once a command's own
 * success handling runs, which can be after the next request in line has
 * started; once it has, the reads hold the revision themselves.
 */
export function answeredRevision(
  cache: QueryClient,
  threadId: ThreadId,
): number {
  const answered = queueMemo(cache)?.get(answeredKey(taskScope(threadId)));
  return typeof answered === "number" ? answered : 0;
}

/**
 * The Tasks shown but not yet at the service: each one a Note conversion
 * still in its Undo window or on its way. Until it commits, there is nothing
 * at the service for a command on it to act upon.
 */
export function usePendingTaskIds(): ReadonlySet<TaskId> {
  const notes = useMutationState({
    filters: { mutationKey: noteConversionKey, status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as { note?: Pick<Note, "_id"> } | undefined)
        ?.note?._id,
  });
  const signature = notes.join("\n");
  return useMemo(
    () =>
      new Set(
        signature
          .split("\n")
          .filter(Boolean)
          .map((noteId) => noteTaskId({ _id: noteId as Note["_id"] })),
      ),
    [signature],
  );
}
