import type { Thread } from "@vita-os/contracts";

import { useCompleteNextMove as useCompleteNextMoveCommand } from "./hooks";

/**
 * Complete this Thread's Next Move.
 *
 * The Thread carries the move being completed and the revision it was read at,
 * so a second click cannot complete the move that was promoted into its place.
 */
export function useCompleteNextMove(thread: Thread) {
  const completeNextMove = useCompleteNextMoveCommand();

  return () => completeNextMove.mutateAsync({ thread });
}
