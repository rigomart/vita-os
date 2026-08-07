import type { PlanItem } from "./model";

import { mockAreaById } from "../mock-data";
import { landedLabel, seedItems } from "./model";

/**
 * Local, undoable state for the Plan view.
 *
 * Every mutation pushes a snapshot of the whole item list onto an undo stack,
 * so the confirmation strip can always take the last thing back. The strip is
 * never on a timer: it stays until it is undone, superseded, or dismissed.
 */

export type NoticeTone = "default" | "move" | "resolve";

export interface UndoEntry {
  detail?: string;
  id: number;
  /** The item list as it stood *before* the action. */
  items: PlanItem[];
  message: string;
  tone: NoticeTone;
}

export interface PlanState {
  items: PlanItem[];
  seq: number;
  /** Most recent action last. Undo pops; the strip shows the top. */
  undo: UndoEntry[];
}

export type PlanAction =
  | { itemId: string; text: string; type: "set-next-move" }
  | { itemId: string; toAreaId: string; type: "move-area" }
  | { itemId: string; type: "complete-next-move" }
  | { itemId: string; type: "resolve" }
  | { date: number | undefined; itemId: string; type: "set-date" }
  | {
      columnDrop: "clear" | "schedule";
      date: number | undefined;
      itemId: string;
      reschedule: boolean;
      toRowId: string;
      type: "drop";
    }
  | { type: "dismiss" }
  | { type: "undo" };

export function initialPlanState(): PlanState {
  return { items: seedItems(), seq: 0, undo: [] };
}

export function currentNotice(state: PlanState): UndoEntry | undefined {
  return state.undo.at(-1);
}

function areaName(areaId: string): string {
  return mockAreaById.get(areaId)?.name ?? "another Area";
}

function commit(
  state: PlanState,
  items: PlanItem[],
  notice: Omit<UndoEntry, "id" | "items">,
): PlanState {
  const id = state.seq + 1;
  return {
    items,
    seq: id,
    undo: [...state.undo, { ...notice, id, items: state.items }],
  };
}

function patch(
  items: PlanItem[],
  itemId: string,
  change: Partial<PlanItem>,
): PlanItem[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...change } : item,
  );
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "dismiss":
      return state.undo.length > 0 ? { ...state, undo: [] } : state;

    case "undo": {
      const last = state.undo.at(-1);
      if (!last) return state;
      return {
        items: last.items,
        seq: state.seq,
        undo: state.undo.slice(0, -1),
      };
    }

    case "drop": {
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item) return state;

      const movedArea =
        item.kind === "thread" &&
        action.toRowId !== item.areaId &&
        action.toRowId !== "inbox";
      if (!movedArea && !action.reschedule) return state;

      const change: Partial<PlanItem> = {};
      if (movedArea) change.areaId = action.toRowId;
      if (action.reschedule) change.date = action.date;

      const landed = landedLabel(action.date, item.kind);

      return commit(
        state,
        patch(state.items, action.itemId, change),
        movedArea
          ? {
              message: `Moved to ${areaName(action.toRowId)}`,
              detail: action.reschedule
                ? `${landed} · activity logged`
                : "activity logged",
              tone: "move",
            }
          : {
              message: capitalize(landed),
              detail: item.title,
              tone: "default",
            },
      );
    }

    case "set-date": {
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item || item.date === action.date) return state;

      return commit(
        state,
        patch(state.items, action.itemId, { date: action.date }),
        {
          message: capitalize(landedLabel(action.date, item.kind)),
          detail: item.title,
          tone: "default",
        },
      );
    }

    case "set-next-move": {
      const text = action.text.trim();
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item || text === (item.nextMove ?? "")) return state;

      return commit(
        state,
        patch(state.items, action.itemId, {
          nextMove: text.length > 0 ? text : undefined,
        }),
        {
          message: text.length > 0 ? "Next Move updated" : "Next Move removed",
          detail: item.title,
          tone: "default",
        },
      );
    }

    case "complete-next-move": {
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item?.nextMove) return state;

      return commit(
        state,
        patch(state.items, action.itemId, { nextMove: undefined }),
        {
          message: "Next Move marked done",
          detail: `${item.title} needs a new one`,
          tone: "default",
        },
      );
    }

    case "move-area": {
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item || item.kind !== "thread" || item.areaId === action.toAreaId) {
        return state;
      }

      return commit(
        state,
        patch(state.items, action.itemId, { areaId: action.toAreaId }),
        {
          message: `Moved to ${areaName(action.toAreaId)}`,
          detail: "activity logged",
          tone: "move",
        },
      );
    }

    case "resolve": {
      const item = state.items.find((entry) => entry.id === action.itemId);
      if (!item) return state;

      return commit(
        state,
        state.items.filter((entry) => entry.id !== action.itemId),
        {
          message: `${item.kind === "task" ? "Marked done" : "Resolved"} “${item.title}”`,
          detail:
            item.kind === "task" ? undefined : "No longer needs your attention",
          tone: "resolve",
        },
      );
    }

    default:
      return state;
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
