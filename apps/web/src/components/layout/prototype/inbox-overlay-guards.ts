// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.

import { useEffect, useRef } from "react";

// Document-level key listeners in a prototype surface must not steal keys that
// belong to something layered on top of it. Everything the Inbox can open —
// the process dialog (ResponsiveDialog → Dialog/Drawer), the When picker
// (Popover + Calendar), the discard confirm (AlertDialog), any Select or
// Combobox — portals to the body and tags its popup with a `*-content`
// data-slot, so one attribute-suffix selector covers them all.
export const NESTED_OVERLAY_SELECTOR = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="drawer-content"]',
  '[data-slot="sheet-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-slot="select-content"]',
  '[data-slot="combobox-content"]',
].join(",");

/**
 * Prototype chrome that drives the surface itself — the top-bar Inbox trigger
 * and the form switcher pill. Clicks on these must not count as "outside": the
 * trigger toggles on its own, and the pill swaps forms while one is open.
 */
export const INBOX_PROTO_CHROME_SELECTOR = "[data-inbox-proto-chrome]";

/** True while any portaled overlay is mounted above the surface. */
export function hasNestedOverlay() {
  if (typeof document === "undefined") return false;
  return document.querySelector(NESTED_OVERLAY_SELECTOR) !== null;
}

/**
 * Escape closes the surface — but only when Escape was not aimed at something
 * the surface opened on top of itself.
 */
export function useInboxSurfaceEscape(onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (hasNestedOverlay()) return;
      onEscapeRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
