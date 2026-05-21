export function patchById<T extends { _id: string }>(
  tasks: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return tasks.map((task) => (task._id === id ? { ...task, ...patch } : task));
}

export function removeById<T extends { _id: string }>(
  tasks: T[],
  id: string,
): T[] {
  return tasks.filter((task) => task._id !== id);
}

export function nextOrder(tasks: Array<{ order: number }>): number {
  return tasks.reduce((max, task) => Math.max(max, task.order), -1) + 1;
}
