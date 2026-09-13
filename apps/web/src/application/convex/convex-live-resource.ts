import type { LiveResource } from "@vita-os/contracts";

export interface ConvexWatch<T> {
  onUpdate(listener: () => void): () => void;
  localQueryResult(): T | undefined;
}

export function createConvexLiveResource<TSource, TSnapshot>(options: {
  createWatch: () => ConvexWatch<TSource>;
  initialSnapshot: TSnapshot;
  readSnapshot: (value: TSource | undefined) => TSnapshot;
  readError: (error: unknown) => TSnapshot;
}): LiveResource<TSnapshot> {
  let snapshot = options.initialSnapshot;
  let watch: ConvexWatch<TSource> | undefined;
  let stopWatching: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const updateSnapshot = () => {
    if (!watch) return;
    let next: TSnapshot;
    try {
      next = options.readSnapshot(watch.localQueryResult());
    } catch (error) {
      next = options.readError(error);
    }
    if (Object.is(next, snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        watch = options.createWatch();
        stopWatching = watch.onUpdate(updateSnapshot);
        updateSnapshot();
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopWatching?.();
        stopWatching = undefined;
        watch = undefined;
      };
    },
  };
}
