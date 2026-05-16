export function patchById<T extends { _id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) => (item._id === id ? { ...item, ...patch } : item));
}

export function removeById<T extends { _id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((item) => item._id !== id);
}

export function nextOrder(items: Array<{ order: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
}
