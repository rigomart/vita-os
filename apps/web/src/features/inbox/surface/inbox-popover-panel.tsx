import { useEffect, useRef } from "react";

import {
  useCloseOnEscape,
  useCloseOnOutsidePointerDown,
} from "./inbox-overlay-guards";
import { InboxSurfaceBody } from "./inbox-surface-body";
import { INBOX_SURFACE_PANEL_ID } from "./inbox-surface-trigger";

interface InboxPopoverPanelProps {
  /** False while the panel animates out; it unmounts on `onExited`. */
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}

/**
 * The Inbox as a panel under the top bar's right edge, where its trigger lives.
 * Non-modal on purpose: the page behind stays live and scrollable, focus moves
 * in without being trapped, and Escape, the close button or a click outside
 * dismiss it.
 */
export function InboxPopoverPanel({
  open,
  onClose,
  onExited,
}: InboxPopoverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useCloseOnEscape(onClose);
  useCloseOnOutsidePointerDown(panelRef, onClose);
  useReturnFocusOnClose(panelRef, open);

  return (
    <div
      ref={panelRef}
      id={INBOX_SURFACE_PANEL_ID}
      role="dialog"
      aria-label="Inbox"
      aria-hidden={open ? undefined : true}
      tabIndex={-1}
      data-slot="inbox-surface-panel"
      data-state={open ? "open" : "closed"}
      className="pointer-events-none fixed top-14 right-4 z-50 flex max-h-[min(44rem,78dvh)] w-[26rem] origin-top-right scale-95 flex-col overflow-hidden rounded-xl border bg-popover text-sm text-popover-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150 ease-out outline-none data-[state=open]:pointer-events-auto data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:-translate-y-1 motion-reduce:transition-none"
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity" &&
          !open
        ) {
          onExited();
        }
      }}
    >
      <InboxSurfaceBody onClose={onClose} />
    </div>
  );
}

/**
 * Focus follows the panel: into it when it opens, back to whatever summoned it
 * when it closes — provided that control is still on the page and the focus is
 * still inside the panel to give back.
 */
function useReturnFocusOnClose(
  panelRef: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  const summonedFromRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    summonedFromRef.current ??= document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      const summonedFrom = summonedFromRef.current;
      if (
        summonedFrom?.isConnected &&
        panelRef.current?.contains(document.activeElement)
      ) {
        summonedFrom.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}
