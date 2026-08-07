import type { MockThread } from "../mock-data";

import { mockAreaById, mockThreads } from "../mock-data";

/**
 * Local, undoable state for the Area × time grid.
 *
 * Every mutation snapshots the previous Thread list so the confirmation strip
 * can offer a single-step Undo — rescheduling and Area moves are cheap to make
 * and should be just as cheap to take back.
 */

export type NoticeTone = "default" | "move" | "resolve";

export interface PlanNotice {
  detail?: string;
  id: number;
  message: string;
  tone: NoticeTone;
  undoable: boolean;
}

export interface PlanState {
  history: MockThread[] | null;
  notice: PlanNotice | null;
  noticeSeq: number;
  threads: MockThread[];
}

export type PlanAction =
  | { type: "dismiss" }
  | {
      columnLabel: string;
      followUp: number | undefined;
      reschedule: boolean;
      threadId: string;
      toAreaId: string;
      type: "drop";
    }
  | { type: "complete-next-move"; threadId: string }
  | { followUp: number | undefined; threadId: string; type: "set-follow-up" }
  | { text: string; threadId: string; type: "set-next-move" }
  | { threadId: string; toAreaId: string; type: "move-area" }
  | { threadId: string; type: "resolve" }
  | { type: "undo" };

export function initialPlanState(): PlanState {
  return {
    history: null,
    notice: null,
    noticeSeq: 0,
    // Copies, so the shared module-level mock array is never mutated.
    threads: mockThreads.map((thread) => ({ ...thread })),
  };
}

function areaName(areaId: string): string {
  return mockAreaById.get(areaId)?.name ?? "another Area";
}

function commit(
  state: PlanState,
  threads: MockThread[],
  notice: Omit<PlanNotice, "id">,
): PlanState {
  return {
    history: state.threads,
    noticeSeq: state.noticeSeq + 1,
    notice: { ...notice, id: state.noticeSeq + 1 },
    threads,
  };
}

function patch(
  threads: MockThread[],
  threadId: string,
  change: Partial<MockThread>,
): MockThread[] {
  return threads.map((thread) =>
    thread.id === threadId ? { ...thread, ...change } : thread,
  );
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "dismiss":
      return state.notice ? { ...state, notice: null } : state;

    case "undo": {
      if (!state.history) return state;
      return {
        history: null,
        noticeSeq: state.noticeSeq,
        notice: null,
        threads: state.history,
      };
    }

    case "drop": {
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread) return state;

      const movedArea = thread.areaId !== action.toAreaId;
      if (!movedArea && !action.reschedule) return state;

      const change: Partial<MockThread> = { areaId: action.toAreaId };
      if (action.reschedule) change.followUp = action.followUp;

      const next = patch(state.threads, action.threadId, change);
      const scheduled = action.reschedule
        ? `Follow-up ${action.columnLabel.toLowerCase()}`
        : undefined;

      return commit(
        state,
        next,
        movedArea
          ? {
              message: `Moved to ${areaName(action.toAreaId)}`,
              detail: scheduled
                ? `${scheduled} · activity logged`
                : "Activity logged on the Thread",
              tone: "move",
              undoable: true,
            }
          : {
              message: `Follow-up ${action.columnLabel.toLowerCase()}`,
              detail: thread.title,
              tone: "default",
              undoable: true,
            },
      );
    }

    case "set-follow-up": {
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread) return state;

      return commit(
        state,
        patch(state.threads, action.threadId, { followUp: action.followUp }),
        {
          message:
            action.followUp == null ? "Follow-up cleared" : "Follow-up updated",
          detail: thread.title,
          tone: "default",
          undoable: true,
        },
      );
    }

    case "set-next-move": {
      const text = action.text.trim();
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread || text === (thread.nextMove ?? "")) return state;

      return commit(
        state,
        patch(state.threads, action.threadId, {
          nextMove: text.length > 0 ? text : undefined,
        }),
        {
          message: text.length > 0 ? "Next Move updated" : "Next Move removed",
          detail: thread.title,
          tone: "default",
          undoable: true,
        },
      );
    }

    case "complete-next-move": {
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread?.nextMove) return state;

      return commit(
        state,
        patch(state.threads, action.threadId, { nextMove: undefined }),
        {
          message: "Next Move done",
          detail: `${thread.title} needs a new one`,
          tone: "default",
          undoable: true,
        },
      );
    }

    case "move-area": {
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread || thread.areaId === action.toAreaId) return state;

      return commit(
        state,
        patch(state.threads, action.threadId, { areaId: action.toAreaId }),
        {
          message: `Moved to ${areaName(action.toAreaId)}`,
          detail: "Activity logged on the Thread",
          tone: "move",
          undoable: true,
        },
      );
    }

    case "resolve": {
      const thread = state.threads.find((item) => item.id === action.threadId);
      if (!thread) return state;

      return commit(
        state,
        state.threads.filter((item) => item.id !== action.threadId),
        {
          message: "Thread resolved",
          detail: thread.title,
          tone: "resolve",
          undoable: true,
        },
      );
    }

    default:
      return state;
  }
}
