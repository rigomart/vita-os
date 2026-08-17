// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Form "rail": the Inbox as a right-side push rail, copied from the Thread
// detail rail (spacer in the app-shell flex row + fixed aside). When the Thread
// rail is also open the Inbox sits immediately to its left, so the two rails
// stack side by side and the page content gets pushed by both spacers.

import { useDeferredRouteClose } from "@/features/threads/thread-detail/use-deferred-route-close";

import { useInboxSurfaceEscape } from "./inbox-overlay-guards";
import { InboxSurfaceBody } from "./inbox-surface-body";

const RAIL_WIDTH = "clamp(28rem,34vw,34rem)";

export function InboxRailPane({
  threadOpen,
  onClosed,
}: {
  threadOpen: boolean;
  onClosed: () => void;
}) {
  const { open, requestClose, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  // Dismissal parity with the other forms — the rail has no backdrop to click.
  useInboxSurfaceEscape(requestClose);

  return (
    <>
      <div
        data-slot="inbox-prototype-rail-space"
        data-state={open ? "open" : "closed"}
        className="relative w-0 min-w-0 shrink-0 transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:w-[clamp(28rem,34vw,34rem)] motion-reduce:transition-none"
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "width" &&
            !open
          ) {
            completeOpenChange(false);
          }
        }}
      />
      <aside
        aria-label="Inbox"
        data-slot="inbox-prototype-rail"
        data-state={open ? "open" : "closed"}
        style={{ right: threadOpen ? RAIL_WIDTH : "0px" }}
        className="fixed inset-y-0 z-30 flex h-dvh w-[clamp(28rem,34vw,34rem)] translate-x-full flex-col border-l bg-popover text-sm text-popover-foreground shadow-xl transition-[transform,right] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:translate-x-0 motion-reduce:transition-none"
      >
        <InboxSurfaceBody onClose={requestClose} />
      </aside>
    </>
  );
}
