// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Form "popover": a small non-modal panel hanging under the top bar's right
// edge, where the Inbox button lives. Anchoring a real Popover across component
// boundaries would mean threading a trigger ref through the top bar, so — per
// the spec's escape hatch — this is a fixed panel positioned under the top-bar
// right side instead. Non-modal: the page behind stays live and scrollable;
// Escape, the close button, or a click outside dismiss it.

import { useEffect, useRef } from "react";

import { useDeferredRouteClose } from "@/features/threads/thread-detail/use-deferred-route-close";

import {
  hasNestedOverlay,
  INBOX_PROTO_CHROME_SELECTOR,
  useInboxSurfaceEscape,
} from "./inbox-overlay-guards";
import { InboxSurfaceBody } from "./inbox-surface-body";

export function InboxPopoverPanel({ onClosed }: { onClosed: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { open, requestClose, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  useInboxSurfaceEscape(requestClose);
  useOutsideClickClose(panelRef, requestClose);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Inbox"
      data-slot="inbox-prototype-popover"
      data-state={open ? "open" : "closed"}
      className="fixed top-14 right-4 z-50 flex max-h-[min(44rem,78dvh)] w-[26rem] origin-top-right scale-95 flex-col overflow-hidden rounded-xl border bg-popover text-sm text-popover-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150 ease-out data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:-translate-y-1 motion-reduce:transition-none"
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity" &&
          !open
        ) {
          completeOpenChange(false);
        }
      }}
    >
      <InboxSurfaceBody density="compact" onClose={requestClose} />
    </div>
  );
}

/**
 * Click-outside dismissal for a non-modal panel. Capture phase on purpose: a
 * nested overlay's own backdrop handler unmounts it during the same gesture, so
 * the "is an overlay open?" question has to be asked while it is still mounted.
 */
function useOutsideClickClose(
  panelRef: React.RefObject<HTMLElement | null>,
  onOutsideClick: () => void,
) {
  const onOutsideClickRef = useRef(onOutsideClick);
  onOutsideClickRef.current = onOutsideClick;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.defaultPrevented) return;
      // The process dialog, When picker, discard confirm and any select all
      // portal outside this panel — clicking in them is not "outside".
      if (hasNestedOverlay()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      // The trigger toggles by itself, and the switcher pill swaps forms —
      // closing here first would make the trigger close-then-reopen.
      if (target.closest?.(INBOX_PROTO_CHROME_SELECTOR)) return;
      onOutsideClickRef.current();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [panelRef]);
}
