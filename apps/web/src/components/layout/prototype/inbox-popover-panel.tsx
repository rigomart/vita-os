// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Form "popover": a small non-modal panel hanging under the top bar's right
// edge, where the Inbox button lives. Anchoring a real Popover across component
// boundaries would mean threading a trigger ref through the top bar, so — per
// the spec's escape hatch — this is a fixed panel positioned under the top-bar
// right side instead. Non-modal: the page behind stays live and scrollable;
// Escape or the close button dismiss it.

import { useDeferredRouteClose } from "@/features/threads/thread-detail/use-deferred-route-close";

import { useInboxSurfaceEscape } from "./inbox-overlay-guards";
import { InboxSurfaceBody } from "./inbox-surface-body";

export function InboxPopoverPanel({ onClosed }: { onClosed: () => void }) {
  const { open, requestClose, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  useInboxSurfaceEscape(requestClose);

  return (
    <div
      role="dialog"
      aria-label="Inbox"
      data-slot="inbox-prototype-popover"
      data-state={open ? "open" : "closed"}
      className="fixed top-14 right-4 z-50 flex max-h-[72dvh] w-[26rem] origin-top-right scale-95 flex-col overflow-hidden rounded-xl border bg-popover text-sm text-popover-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150 ease-out data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:-translate-y-1 motion-reduce:transition-none"
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
      <InboxSurfaceBody onClose={requestClose} />
    </div>
  );
}
