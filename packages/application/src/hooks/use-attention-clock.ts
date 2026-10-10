import { useSyncExternalStore } from "react";

import { clock } from "../lib/clock";

/**
 * The attention clock — one "now" for every surface that reads a date. The
 * Dashboard's columns and its date all classify by *day*, so they share a
 * timestamp that holds still for the local day and steps forward at local
 * midnight.
 *
 * A module-level store, not per-component state: every consumer sees the same
 * instant and the app arms one timer. It reads the product's `clock`, and
 * starts over from the new time when that clock is set.
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

let now = clock.now();
let rollover: ReturnType<typeof setTimeout> | undefined;
let stopFollowingClock: (() => void) | undefined;
const listeners = new Set<() => void>();

function scheduleRollover() {
  const midnight = nextLocalMidnight(now);

  rollover = setTimeout(
    () => {
      // A timer is allowed to fire a hair early; never land back on the day we
      // just left.
      now = Math.max(clock.now(), midnight);
      scheduleRollover();
      notify();
    },
    Math.max(midnight - clock.now(), 0),
  );
}

function notify() {
  for (const listener of listeners) listener();
}

function restart() {
  clearTimeout(rollover);
  now = clock.now();
  scheduleRollover();
}

function subscribe(listener: () => void): () => void {
  // With nobody watching, the clock stops. Re-read it before arming the timer
  // again; React compares the snapshot after subscribing, so a day that passed
  // while the app was unmounted still lands.
  if (listeners.size === 0) {
    restart();
    stopFollowingClock = clock.subscribe(() => {
      restart();
      notify();
    });
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearTimeout(rollover);
    rollover = undefined;
    stopFollowingClock?.();
    stopFollowingClock = undefined;
  };
}

function snapshot(): number {
  return now;
}

export function useAttentionClock(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
