import type { Move, MoveId, Thread } from "@vita-os/contracts";

import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { useMoveCommand } from "./hooks";

/**
 * A Move command never throws at the surface that issued it. A refusal has
 * already been rolled back on screen; this names it for the person, so a Move
 * that reappears does not look like a glitch.
 */
function useReportFailure() {
  const feedback = useFeedback();

  return (error: unknown) => {
    const conflict = isApplicationError(error) && error.code === "conflict";
    feedback.error(
      conflict
        ? "This Thread changed elsewhere. It has been refreshed."
        : "Could not save that change. Please try again.",
    );
  };
}

/** Complete one of this Thread's Moves: all the Dashboard card can do. */
export function useCompleteMove(thread: Thread) {
  const report = useReportFailure();
  const complete = useMoveCommand<MoveId>(thread, {
    run: (client, moveId, expectedRevision) =>
      client.completeMove({ threadId: thread._id, moveId, expectedRevision }),
    change: (moveId) => ({ kind: "complete", moveId }),
  });

  return (moveId: MoveId) =>
    complete.mutateAsync(moveId).then(() => undefined, report);
}

/**
 * Every Move action Thread detail offers. Each shows its change at once, and
 * none asks for a priority: a new Move joins the end of the list unfocused.
 */
export function useMoves(thread: Thread) {
  const report = useReportFailure();

  const add = useMoveCommand<Move>(thread, {
    run: (client, move, expectedRevision) =>
      client.addMove({
        threadId: thread._id,
        moveId: move._id,
        text: move.text,
        expectedRevision,
      }),
    change: (move) => ({ kind: "add", move }),
  });
  const edit = useMoveCommand<{ moveId: MoveId; text: string }>(thread, {
    run: (client, input, expectedRevision) =>
      client.editMove({ threadId: thread._id, ...input, expectedRevision }),
    change: (input) => ({ kind: "edit", ...input }),
  });
  const remove = useMoveCommand<MoveId>(thread, {
    run: (client, moveId, expectedRevision) =>
      client.removeMove({ threadId: thread._id, moveId, expectedRevision }),
    change: (moveId) => ({ kind: "remove", moveId }),
  });
  const complete = useMoveCommand<MoveId>(thread, {
    run: (client, moveId, expectedRevision) =>
      client.completeMove({ threadId: thread._id, moveId, expectedRevision }),
    change: (moveId) => ({ kind: "complete", moveId }),
  });
  const focus = useMoveCommand<MoveId | null>(thread, {
    run: (client, moveId, expectedRevision) =>
      client.focusMove({ threadId: thread._id, moveId, expectedRevision }),
    change: (moveId) => ({ kind: "focus", moveId }),
  });

  const settle = (pending: Promise<unknown>) =>
    pending.then(() => undefined, report);

  return {
    add: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      return settle(
        add.mutateAsync({ _id: newRecordId() as MoveId, text: trimmed }),
      );
    },
    edit: (moveId: MoveId, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      return settle(edit.mutateAsync({ moveId, text: trimmed }));
    },
    remove: (moveId: MoveId) => settle(remove.mutateAsync(moveId)),
    complete: (moveId: MoveId) => settle(complete.mutateAsync(moveId)),
    /** `null` unfocuses; focusing a Move replaces any earlier focus. */
    focus: (moveId: MoveId | null) => settle(focus.mutateAsync(moveId)),
  };
}
