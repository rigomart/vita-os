import type {
  ActivityLogEntryType,
  CompleteNextMoveOutput,
  ThreadId,
} from "@vita-os/contracts";

export interface NextMoveCompletionState {
  nextMove?: string;
  upNext?: readonly string[];
}

export interface NextMoveCompletionActivity {
  type: Extract<ActivityLogEntryType, "next_action_change">;
  content: string;
  previousValue: string;
  newValue?: string;
}

export type NextMoveCompletionDecision =
  | { status: "unchanged" }
  | {
      status: "apply";
      patch: { nextMove?: string; upNext?: string[] };
      activity: NextMoveCompletionActivity;
    };

export function decideNextMoveCompletion(
  state: NextMoveCompletionState,
): NextMoveCompletionDecision {
  if (!state.nextMove) return { status: "unchanged" };

  const [promoted, ...remaining] = state.upNext ?? [];
  return {
    status: "apply",
    patch: {
      nextMove: promoted,
      upNext: remaining.length > 0 ? remaining : undefined,
    },
    activity: {
      type: "next_action_change",
      content: promoted
        ? `Completed "${state.nextMove}" — next move set to "${promoted}"`
        : `Completed "${state.nextMove}" — next move cleared`,
      previousValue: state.nextMove,
      newValue: promoted,
    },
  };
}

export interface CompleteNextMoveStore {
  completeAtomically(
    input: {
      actorId: string;
      threadId: ThreadId;
      expectedNextMove?: string | null;
      expectedRevision?: number;
    },
    decide: typeof decideNextMoveCompletion,
  ): Promise<CompleteNextMoveOutput>;
}

export function completeNextMove(
  store: CompleteNextMoveStore,
  input: {
    actorId: string;
    threadId: ThreadId;
    expectedNextMove?: string | null;
    expectedRevision?: number;
  },
): Promise<CompleteNextMoveOutput> {
  return store.completeAtomically(input, decideNextMoveCompletion);
}
