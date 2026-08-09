import { useSyncExternalStore } from "react";

/**
 * The attention clock — one "now" for every surface that reads a date.
 *
 * Inbox ordering, Thread attention grouping, the Dashboard date and the Plan
 * axis all classify by *day*, so they read a single timestamp that holds still
 * for the whole local day and steps forward once, at local midnight. Nothing
 * has to remount for the day to turn over, and no surface drifts onto its own
 * idea of today by reading the wall clock as it renders.
 *
 * The clock is a module-level store rather than per-component state so that
 * every consumer sees the same instant and the app arms one timer, not one per
 * mounted list.
 */

/** The midnight that opens the local calendar day after `at`. */
export function nextLocalMidnight(at: number): number {
  const date = new Date(at);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
}

let now = Date.now();
let rollover: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function scheduleRollover() {
  const midnight = nextLocalMidnight(now);

  rollover = setTimeout(
    () => {
      // A timer is allowed to fire a hair early; never land back on the day we
      // just left.
      now = Math.max(Date.now(), midnight);
      scheduleRollover();
      for (const listener of listeners) listener();
    },
    Math.max(midnight - Date.now(), 0),
  );
}

function subscribe(listener: () => void): () => void {
  // With nobody watching, the clock stops. Re-read it before arming the timer
  // again; React compares the snapshot after subscribing, so a day that passed
  // while the app was unmounted still lands.
  if (listeners.size === 0) {
    now = Date.now();
    scheduleRollover();
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearTimeout(rollover);
    rollover = undefined;
  };
}

function snapshot(): number {
  return now;
}

export function useAttentionClock(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
