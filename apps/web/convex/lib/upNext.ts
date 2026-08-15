import { requireTitle } from "./validation";

/**
 * Up Next: the ordered line of upcoming moves a Thread holds behind its Next
 * Move (docs/adr/0010-up-next-behind-the-next-move.md). Plain text — no dates,
 * no done states — with queue semantics: the Next Move is the front of the
 * line, and emptying that slot promotes the next move into it.
 *
 * Absent and empty mean the same thing, so only `undefined` is ever stored: a
 * Thread with nothing lined up reads exactly as it did before Up Next existed.
 */

/**
 * Up Next writes are open-Thread edits. A resolved Thread discarded its line
 * at resolution; writing to it would refill the Next Move slot through the
 * promotion invariant and resurrect attention state that reopening must not
 * restore.
 */
export function requireOpenForUpNext(thread: {
  state: "open" | "resolved";
}): void {
  if (thread.state !== "open") {
    throw new Error("Cannot line up moves on a resolved thread");
  }
}

/** The list as the Thread stores it — `undefined` once nothing is left. */
export function storedUpNext(moves: readonly string[]): string[] | undefined {
  return moves.length > 0 ? [...moves] : undefined;
}

/** Every move, trimmed. A blank move is refused like any other named text. */
export function requireUpNextMoves(moves: readonly string[]): string[] {
  return moves.map((move) => requireTitle(move, "Upcoming move"));
}

/**
 * The front of the line, taken off it: the move that fills the Next Move slot
 * and the shorter list left behind. `null` when nothing is lined up, which is
 * the caller's signal to leave the slot as it is.
 */
export function takeFrontUpNextMove(
  moves: readonly string[] | undefined,
): { nextMove: string; upNext: string[] | undefined } | null {
  const [front, ...rest] = moves ?? [];
  if (front === undefined) return null;
  return { nextMove: front, upNext: storedUpNext(rest) };
}
