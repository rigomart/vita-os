import type { Move, MoveId, ThreadState } from "@vita-os/contracts";

import type { ThreadUpdateDecision } from "./thread-changes";

import { ConflictError, ValidationError } from "./errors";
import { requireNonBlankText } from "./text";

/**
 * Moves: the useful actions a Thread holds, as peers. They are kept in the
 * order they were captured, which is for finding things and never a priority,
 * and the person may single out one of them as the Focused Move.
 *
 * Every rule here decides one command against the Thread as it was read. A rule
 * that names a Move the Thread no longer holds answers `null`: the caller saw a
 * different Thread, so the command is refused rather than applied to something
 * else.
 *
 * Only completion writes to the Activity Log. Adding, editing, removing and
 * focusing are silent, so the log stays about what happened to the situation.
 */

export interface MoveState {
  state: ThreadState;
  moves?: Move[];
  focusedMoveId?: MoveId;
}

/** A Move ID is opaque, but it has to be something a URL and a row can hold. */
const MAX_MOVE_ID_LENGTH = 64;

export function requireMoveText(text: string): string {
  return requireNonBlankText(text, "Move");
}

export function requireMoveId(moveId: string): MoveId {
  if (moveId.length === 0 || moveId.length > MAX_MOVE_ID_LENGTH) {
    throw new ValidationError("Invalid Move");
  }
  return moveId as MoveId;
}

/**
 * Adding, editing and focusing are open-Thread edits. A resolved Thread
 * discarded its Moves, and a finished situation cannot quietly gain new work.
 */
export function requireOpenForMoves(thread: { state: ThreadState }): void {
  if (thread.state !== "open") {
    throw new ConflictError("Cannot change the moves of a resolved thread");
  }
}

/** The list as the Thread stores it — absent once nothing is left. */
function stored(moves: readonly Move[]): Move[] | undefined {
  return moves.length > 0 ? [...moves] : undefined;
}

function findMove(thread: MoveState, moveId: MoveId): Move | undefined {
  return thread.moves?.find((move) => move._id === moveId);
}

/** The list without one Move, and focus cleared if it was the one focused. */
function without(thread: MoveState, moveId: MoveId) {
  return {
    moves: stored((thread.moves ?? []).filter((move) => move._id !== moveId)),
    ...(thread.focusedMoveId === moveId ? { focusedMoveId: undefined } : {}),
  };
}

/**
 * A new Move joins the end of the list, unfocused: capturing never asks
 * whether it matters most. An ID the Thread already holds is a conflict.
 */
export function decideAddMove(
  thread: MoveState,
  move: Move,
): ThreadUpdateDecision | null {
  requireOpenForMoves(thread);
  if (findMove(thread, move._id)) return null;

  return {
    patch: { moves: [...(thread.moves ?? []), move] },
    logs: [],
  };
}

export function decideEditMove(
  thread: MoveState,
  moveId: MoveId,
  text: string,
): ThreadUpdateDecision | null {
  requireOpenForMoves(thread);
  const move = findMove(thread, moveId);
  if (!move) return null;
  if (move.text === text) return { patch: {}, logs: [] };

  return {
    patch: {
      moves: (thread.moves ?? []).map((existing) =>
        existing._id === moveId ? { ...existing, text } : existing,
      ),
    },
    logs: [],
  };
}

/** A dropped idea leaves no trace in the Activity Log. */
export function decideRemoveMove(
  thread: MoveState,
  moveId: MoveId,
): ThreadUpdateDecision | null {
  if (!findMove(thread, moveId)) return null;

  return { patch: without(thread, moveId), logs: [] };
}

/**
 * Completing any Move — focused or not — takes it off the Thread and records
 * it. Completing the Focused Move leaves the Thread unfocused: nothing is
 * promoted, so the app never picks the next focus. Completing the last Move
 * leaves the Thread open; the situation may still need attention.
 */
export function decideCompleteMove(
  thread: MoveState,
  moveId: MoveId,
): ThreadUpdateDecision | null {
  const move = findMove(thread, moveId);
  if (!move) return null;

  return {
    patch: without(thread, moveId),
    logs: [
      {
        type: "move_completed",
        content: `Completed "${move.text}"`,
        previousValue: move.text,
      },
    ],
  };
}

/**
 * Focus one Move, replacing any earlier focus, or (with `null`) none. The
 * toggle a surface offers — focusing the focused Move unfocuses it — is the
 * surface's to compute; this rule only sets what it is told.
 */
export function decideFocusMove(
  thread: MoveState,
  moveId: MoveId | null,
): ThreadUpdateDecision | null {
  requireOpenForMoves(thread);
  if (moveId !== null && !findMove(thread, moveId)) return null;

  const focusedMoveId = moveId ?? undefined;
  if (focusedMoveId === thread.focusedMoveId) return { patch: {}, logs: [] };

  return { patch: { focusedMoveId }, logs: [] };
}

/**
 * The Move a card leads with: the Focused Move, else the only Move. With
 * several Moves and none focused there is no lead — the card must not invent
 * a headline the person never chose.
 */
export function leadMove(thread: {
  moves?: readonly Move[];
  focusedMoveId?: MoveId;
}): Move | undefined {
  const moves = thread.moves ?? [];
  const focused = moves.find((move) => move._id === thread.focusedMoveId);
  if (focused) return focused;
  return moves.length === 1 ? moves[0] : undefined;
}

export function hasMoves(thread: { moves?: readonly Move[] }): boolean {
  return (thread.moves?.length ?? 0) > 0;
}
