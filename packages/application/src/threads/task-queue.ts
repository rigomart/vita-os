import type { QueryClient } from "@tanstack/react-query";
import type { Note, TaskId, Thread, ThreadId } from "@vita-os/contracts";

import { useMutationState } from "@tanstack/react-query";
import { useMemo } from "react";

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

/** Marks the commands that turn a Note into a Task. */
export const noteConversionKey = ["note-conversion"] as const;

/**
 * Settles once no Task command of this Thread is pending. A conversion carries
 * no revision but moves the Thread's, so it is sent only after the Task
 * commands queued before it; while it is pending the Thread takes no new
 * Task command (`useConversionLock`), so none can follow it in.
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
