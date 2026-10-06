import type { QueryClient } from "@tanstack/react-query";
import type { Note, TaskId, ThreadId } from "@vita-os/contracts";

/**
 * The ID of the Task a dated Note becomes. The caller mints Task IDs (ADR 0022),
 * and a Note converts once, so the Note's own ID names it: the same ID is shown
 * before the service answers, survives a replay, and is the one sent.
 */
export function noteTaskId(note: Pick<Note, "_id">): TaskId {
  return `note-task-${note._id}` as TaskId;
}

const pending = new WeakMap<QueryClient, Map<ThreadId, Promise<void>[]>>();

/**
 * While a Note is being added to a Thread (its Undo window included), the
 * Task it adds is shown but not yet at the service. A Task command on that
 * Thread waits here for the conversion to settle, so it reaches the service
 * after the Task exists and carries the revision the conversion brought back.
 */
export async function holdTaskCommands<T>(
  cache: QueryClient,
  threadId: ThreadId,
  work: () => Promise<T>,
): Promise<T> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const byThread = pending.get(cache) ?? new Map<ThreadId, Promise<void>[]>();
  pending.set(cache, byThread);
  byThread.set(threadId, [...(byThread.get(threadId) ?? []), held]);
  try {
    return await work();
  } finally {
    // After the mutation's own success handling has patched the cache.
    setTimeout(() => {
      const rest = (byThread.get(threadId) ?? []).filter((p) => p !== held);
      if (rest.length === 0) byThread.delete(threadId);
      else byThread.set(threadId, rest);
      release();
    }, 0);
  }
}

export async function afterPendingConversion(
  cache: QueryClient,
  threadId: ThreadId,
): Promise<void> {
  await Promise.all(pending.get(cache)?.get(threadId) ?? []);
}
