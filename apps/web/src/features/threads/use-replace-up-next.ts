import type { Thread } from "@vita-os/contracts";

import { useReplaceUpNext as useReplaceUpNextCommand } from "@vita-os/application";

/**
 * The one editing seam for Up Next: adding, editing, reordering and removing all
 * send the whole ordered line, so a rewrite never depends on what the last one
 * did.
 */
export function useReplaceUpNext(thread: Thread) {
  const replaceUpNext = useReplaceUpNextCommand();

  return (moves: string[]) => replaceUpNext.mutateAsync({ thread, moves });
}
