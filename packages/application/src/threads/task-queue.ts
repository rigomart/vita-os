import type { QueryClient } from "@tanstack/react-query";
import type { Note, TaskId, Thread, ThreadId } from "@vita-os/contracts";

import { useMutationState } from "@tanstack/react-query";
import { useMemo } from "react";

/** The queue every Task command and every edit of one Thread shares. */
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

/** Marks the commands that turn a Note into a Task. */
export const noteConversionKey = ["note-conversion"] as const;

/**
 * A Task command or a second Note conversion refused because a Note is being
 * added to the Thread. Refused before anything shows, so nothing rolls back.
 */
export class ThreadBusy extends Error {
  constructor() {
    super("A note is being added to this thread. Try again in a moment.");
    this.name = "ThreadBusy";
  }
}

/**
 * Whether a Note conversion is pending for this Thread: one adding a Note to
 * it, or the one starting it whose Task it holds. `except` names a
 * conversion's own variables, so it does not count itself.
 */
export function conversionPending(
  cache: QueryClient,
  thread: Pick<Thread, "_id" | "tasks">,
  except?: unknown,
): boolean {
  return pendingConversions(cache, thread).some(
    (variables) => variables !== except,
  );
}

// Conversions the service has answered (or that were undone before reaching
// it), keyed by their variables. Their callbacks may still be running.
const answeredConversions = new WeakSet<object>();

/** Marks a conversion as answered: see `conversionAwaitingAnswer`. */
export function conversionAnswered(variables: object): void {
  answeredConversions.add(variables);
}

/**
 * Whether a conversion into this Thread is still waiting for the service's
 * answer. Until then its Task shows only as its optimistic change, which an
 * answer to a command issued after it (a Thread edit) replays over; that
 * answer may predate the conversion and lack the Task.
 */
export function conversionAwaitingAnswer(
  cache: QueryClient,
  thread: Pick<Thread, "_id" | "tasks">,
): boolean {
  return pendingConversions(cache, thread).some(
    (variables) => !answeredConversions.has(variables),
  );
}

function pendingConversions(
  cache: QueryClient,
  thread: Pick<Thread, "_id" | "tasks">,
): object[] {
  const taskIds = new Set((thread.tasks ?? []).map((task) => task._id));
  return cache
    .getMutationCache()
    .findAll({ mutationKey: noteConversionKey, status: "pending" })
    .flatMap((mutation) => {
      const variables = mutation.state.variables as
        | { note?: Pick<Note, "_id">; thread?: Pick<Thread, "_id"> }
        | undefined;
      if (variables === undefined) return [];
      const into =
        variables.thread?._id === thread._id ||
        (variables.note !== undefined &&
          taskIds.has(noteTaskId(variables.note)));
      return into ? [variables] : [];
    });
}

/**
 * Settles once nothing in this Thread's queue is pending: no Task command and
 * no edit. A conversion carries no revision but moves the Thread's, so it is
 * sent only after the Task commands queued before it; while it is pending the
 * Thread takes no new Task command (`useConversionLock`), so none can follow
 * it in. An edit can, and is answered at whichever revision it lands.
 */
export function afterTaskCommands(
  cache: QueryClient,
  threadId: ThreadId,
): Promise<void> {
  const mutations = cache.getMutationCache();
  const scope = taskScope(threadId);
  const busy = () =>
    mutations
      .getAll()
      .some(
        (mutation) =>
          mutation.options.scope?.id === scope &&
          mutation.state.status === "pending",
      );
  if (!busy()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = mutations.subscribe(() => {
      if (busy()) return;
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Whether a Note conversion into this Thread is pending — its Undo window
 * and its request — and which Tasks it shows. While one is, the whole
 * Thread takes no Task command, so nothing interleaves with it; its own
 * Task reads as pending.
 */
export function useConversionLock(thread: Thread): {
  locked: boolean;
  pendingTaskIds: ReadonlySet<TaskId>;
} {
  const pending = useMutationState({
    filters: { mutationKey: noteConversionKey, status: "pending" },
    select: (mutation) => {
      const variables = mutation.state.variables as
        | { note?: Pick<Note, "_id">; thread?: Pick<Thread, "_id"> }
        | undefined;
      return `${variables?.thread?._id ?? ""} ${variables?.note?._id ?? ""}`;
    },
  });
  const signature = pending.join("\n");
  return useMemo(() => {
    const threadIds = new Set<string>();
    const pendingTaskIds = new Set<TaskId>();
    for (const entry of signature.split("\n").filter(Boolean)) {
      const [threadId, noteId] = entry.split(" ");
      if (threadId) threadIds.add(threadId);
      if (noteId)
        pendingTaskIds.add(noteTaskId({ _id: noteId as Note["_id"] }));
    }
    return {
      locked:
        threadIds.has(thread._id) ||
        (thread.tasks ?? []).some((task) => pendingTaskIds.has(task._id)),
      pendingTaskIds,
    };
  }, [signature, thread._id, thread.tasks]);
}
