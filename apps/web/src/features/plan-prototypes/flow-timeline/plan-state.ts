import type { PlanItem } from "./model";

/**
 * Local-only edit model for the prototype. Every action returns fresh arrays
 * and fresh item objects — nothing from `mock-data` is ever mutated.
 */
export type PlanAction =
  | { id: string; kind: "set-date"; date: number | undefined }
  | { id: string; kind: "set-next-move"; nextMove: string | undefined }
  | { id: string; kind: "set-title"; title: string }
  | { id: string; kind: "remove" }
  | { item: PlanItem; kind: "restore" };

export function planReducer(items: PlanItem[], action: PlanAction): PlanItem[] {
  switch (action.kind) {
    case "remove":
      return items.filter((item) => item.id !== action.id);
    case "restore":
      return items.some((item) => item.id === action.item.id)
        ? items
        : [...items, action.item];
    case "set-date":
      return items.map((item) =>
        item.id === action.id ? { ...item, date: action.date } : item,
      );
    case "set-next-move":
      return items.map((item) =>
        item.id === action.id ? { ...item, nextMove: action.nextMove } : item,
      );
    case "set-title":
      return items.map((item) =>
        item.id === action.id ? { ...item, title: action.title } : item,
      );
  }
}
