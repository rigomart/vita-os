/**
 * The product's one "now". It is the wall clock unless a host sets it, as the
 * lab does to show a screen at another date and time; the product never does.
 *
 * Setting it shifts the wall clock rather than stopping it, so time goes on
 * passing from the moment set, and whatever holds a time of its own (the
 * attention clock, the sky) hears about the change.
 */
let offset = 0;
const listeners = new Set<() => void>();

export const clock = {
  /** Milliseconds since the epoch, as `Date.now()` gives them. */
  now(): number {
    return Date.now() + offset;
  },

  /** Make it `at` from this moment, or the wall clock again with `undefined`. */
  set(at: number | undefined): void {
    offset = at === undefined ? 0 : at - Date.now();
    for (const listener of listeners) listener();
  },

  /** Call `listener` whenever the clock is set; returns the way to stop. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
