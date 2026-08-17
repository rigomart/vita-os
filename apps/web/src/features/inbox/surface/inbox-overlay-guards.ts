import { useEffect, useRef } from "react";

import { INBOX_SURFACE_TRIGGER_SELECTOR } from "./inbox-surface-trigger";

/**
 * Everything the Inbox can open on top of itself — the process dialog
 * (ResponsiveDialog → Dialog/Drawer), the When picker (Popover + Calendar), the
 * discard confirm (AlertDialog), any Select or Combobox — portals out of the
 * surface and tags its popup with a `*-content` data-slot. A document-level
 * listener has to recognise those so it does not steal keys or clicks from them.
 *
 * The query is document-wide, so an overlay opened by any other part of the app
 * suppresses dismissal too. Accepted for now: nothing else can be interacted
 * with while one is up anyway.
 */
const NESTED_OVERLAY_SELECTOR = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="drawer-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-slot="select-content"]',
  '[data-slot="combobox-content"]',
].join(",");

/** True while any portaled overlay is mounted above the surface. */
function hasNestedOverlay() {
  if (typeof document === "undefined") return false;
  return document.querySelector(NESTED_OVERLAY_SELECTOR) !== null;
}

/** Escape closes the surface, unless it was aimed at an overlay above it. */
export function useCloseOnEscape(onEscape: () => void) {
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

/**
 * Click-outside dismissal for a non-modal panel. Capture phase on purpose: an
 * overlay's own backdrop handler unmounts it during the same gesture, so
 * "is an overlay open?" has to be asked while it is still mounted.
 */
export function useCloseOnOutsidePointerDown(
  panelRef: React.RefObject<HTMLElement | null>,
  onOutsidePointerDown: () => void,
) {
  const onOutsidePointerDownRef = useRef(onOutsidePointerDown);
  onOutsidePointerDownRef.current = onOutsidePointerDown;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.defaultPrevented || hasNestedOverlay()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest?.(INBOX_SURFACE_TRIGGER_SELECTOR)) return;
      onOutsidePointerDownRef.current();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [panelRef]);
}
