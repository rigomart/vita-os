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

interface ThreadLine {
  /** Settles when the last request handed to the line has been answered. */
  tail: Promise<unknown>;
  /** The newest revision any answer on the line brought back. */
  revision: number;
}

const lines = new WeakMap<QueryClient, Map<ThreadId, ThreadLine>>();

function lineFor(cache: QueryClient, threadId: ThreadId): ThreadLine {
  const byThread = lines.get(cache) ?? new Map<ThreadId, ThreadLine>();
  lines.set(cache, byThread);
  const line = byThread.get(threadId) ?? {
    tail: Promise.resolve(),
    revision: 0,
  };
  byThread.set(threadId, line);
  return line;
}

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
  const line = lineFor(cache, threadId);
  const turn = line.tail.then(send);
  line.tail = turn.catch(() => undefined);
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
  const line = lineFor(cache, settled._id);
  line.revision = Math.max(line.revision, settled.revision);
  const memo = queueMemo(cache);
  if (memo === undefined) return;
  const scope = taskScope(settled._id);
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

/**
 * The newest revision an answer for this Thread brought back. Reads are
 * patched only once a command's own success handling runs, which can be
 * after the next request in line has started.
 */
export function answeredRevision(
  cache: QueryClient,
  threadId: ThreadId,
): number {
  return lineFor(cache, threadId).revision;
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
