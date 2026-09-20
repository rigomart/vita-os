import type { ThreadId } from "@vita-os/contracts";

import { describe, expect, it, vi } from "vitest";

import {
  completeNextMove,
  decideNextMoveCompletion,
} from "./complete-next-move";

describe("decideNextMoveCompletion", () => {
  it("clears the final Next Move and records its completion", () => {
    expect(
      decideNextMoveCompletion({
        nextMove: "Call clinic",
      }),
    ).toEqual({
      status: "apply",
      patch: {
        nextMove: undefined,
        upNext: undefined,
      },
      activity: {
        type: "next_action_change",
        content: 'Completed "Call clinic" — next move cleared',
        previousValue: "Call clinic",
        newValue: undefined,
      },
    });
  });

  it("promotes the front Up Next move and describes one atomic change", () => {
    expect(
      decideNextMoveCompletion({
        nextMove: "Call clinic",
        upNext: ["Book appointment", "Collect results"],
      }),
    ).toEqual({
      status: "apply",
      patch: {
        nextMove: "Book appointment",
        upNext: ["Collect results"],
      },
      activity: {
        type: "next_action_change",
        content:
          'Completed "Call clinic" — next move set to "Book appointment"',
        previousValue: "Call clinic",
        newValue: "Book appointment",
      },
    });
  });

  it("removes Up Next storage when its only move is promoted", () => {
    expect(
      decideNextMoveCompletion({
        nextMove: "Call clinic",
        upNext: ["Book appointment"],
      }),
    ).toEqual({
      status: "apply",
      patch: {
        nextMove: "Book appointment",
        upNext: undefined,
      },
      activity: {
        type: "next_action_change",
        content:
          'Completed "Call clinic" — next move set to "Book appointment"',
        previousValue: "Call clinic",
        newValue: "Book appointment",
      },
    });
  });

  it("does nothing when the Thread has no Next Move", () => {
    expect(
      decideNextMoveCompletion({
        upNext: ["Impossible under the invariant"],
      }),
    ).toEqual({ status: "unchanged" });
  });
});

describe("completeNextMove", () => {
  it("passes the caller's expected Next Move to atomic storage", async () => {
    const completeAtomically = vi
      .fn()
      .mockResolvedValue({ status: "completed" });

    await completeNextMove(
      { completeAtomically },
      {
        actorId: "user-1",
        threadId: "thread-1" as ThreadId,
        expectedNextMove: "Call clinic",
        expectedRevision: 3,
      },
    );

    expect(completeAtomically).toHaveBeenCalledWith(
      {
        actorId: "user-1",
        threadId: "thread-1",
        expectedNextMove: "Call clinic",
        expectedRevision: 3,
      },
      decideNextMoveCompletion,
    );
  });
});
