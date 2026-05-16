import type { Doc, Id } from "@convex/_generated/dataModel";
import { patchById, removeById } from "@/features/shared/optimistic";

type Item = Doc<"items">;

export function sortInboxItems<
  T extends Pick<Item, "isCompleted" | "createdAt">,
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }

    return b.createdAt - a.createdAt;
  });
}

export function completeItemInInbox<T extends Item>(
  items: T[],
  id: Id<"items">,
  completedAt: number,
): T[] {
  return sortInboxItems(
    items.map((item) =>
      item._id === id ? { ...item, isCompleted: true, completedAt } : item,
    ),
  );
}

export function uncompleteItemInInbox<T extends Item>(
  items: T[],
  id: Id<"items">,
): T[] {
  return sortInboxItems(
    items.map((item) =>
      item._id === id
        ? { ...item, isCompleted: false, completedAt: undefined }
        : item,
    ),
  );
}

export function removeItemFromInbox<T extends Item>(
  items: T[],
  id: Id<"items">,
): T[] {
  return removeById(items, id);
}

export function updateItemTextInInbox<T extends Item>(
  items: T[],
  id: Id<"items">,
  text: string,
): T[] {
  return patchById(items, id, { text } as Partial<T>);
}

export function updateItemDateInInbox<T extends Item>(
  items: T[],
  id: Id<"items">,
  date: number | undefined,
): T[] {
  return patchById(items, id, { date } as Partial<T>);
}

export function isUnprocessedItem(
  item: Pick<Item, "isCompleted" | "date">,
): boolean {
  return !item.isCompleted && item.date === undefined;
}
