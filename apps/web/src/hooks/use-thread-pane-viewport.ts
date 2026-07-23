import { useSyncExternalStore } from "react";

export const THREAD_PANE_BREAKPOINT = 1280;

const mediaQuery =
  typeof window === "undefined"
    ? null
    : window.matchMedia(`(min-width: ${THREAD_PANE_BREAKPOINT}px)`);

function subscribe(onChange: () => void) {
  mediaQuery?.addEventListener("change", onChange);
  return () => mediaQuery?.removeEventListener("change", onChange);
}

function getSnapshot() {
  return mediaQuery?.matches ?? false;
}

function getServerSnapshot() {
  return false;
}

export function useThreadPaneViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
