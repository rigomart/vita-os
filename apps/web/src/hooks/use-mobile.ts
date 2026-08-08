import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
/** Tailwind's `sm`: below it a phone screen is the only layout that fits. */
const COMPACT_BREAKPOINT = 640;

function watch(breakpoint: number) {
  const mql =
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      : null;

  return {
    getSnapshot: () => window.innerWidth < breakpoint,
    subscribe: (cb: () => void) => {
      mql?.addEventListener("change", cb);
      return () => mql?.removeEventListener("change", cb);
    },
  };
}

const mobile = watch(MOBILE_BREAKPOINT);
const compact = watch(COMPACT_BREAKPOINT);

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return useSyncExternalStore(
    mobile.subscribe,
    mobile.getSnapshot,
    getServerSnapshot,
  );
}

/**
 * Phone-sized viewport.
 *
 * Unlike `hidden sm:block`, this switch is a real branch: the compact surface
 * only mounts when it is on screen, so its scroll and observer effects never
 * run against a hidden tree.
 */
export function useIsCompact() {
  return useSyncExternalStore(
    compact.subscribe,
    compact.getSnapshot,
    getServerSnapshot,
  );
}
