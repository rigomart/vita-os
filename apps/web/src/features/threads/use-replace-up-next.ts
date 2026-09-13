import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import type { ThreadView } from "@/features/threads/thread-view";

import { optimisticallyReplaceUpNext } from "@/features/threads/optimistic";

/**
 * The one editing seam for Up Next: adding, editing, reordering and removing
 * all send the whole ordered line, so a rewrite never depends on what the last
 * one did. Blank moves are refused by the server — callers trim first.
 */
export function useReplaceUpNext(thread: ThreadView) {
  const replaceUpNextMutation = useMutation(
    api.threads.replaceUpNext,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyReplaceUpNext(localStore, args, {
      thread: thread as unknown as ProjectedThread,
    });
  });

  return (moves: string[]) =>
    replaceUpNextMutation({
      id: thread._id as Id<"threads">,
      moves: sanitizeMoves(moves),
    });
}

/** Nothing blank reaches the server, and nothing blank survives a rewrite. */
function sanitizeMoves(moves: readonly string[]): string[] {
  return moves.map((move) => move.trim()).filter((move) => move.length > 0);
}
