// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Picks the candidate surface for the active form, falling back to the shared
// bottom drawer below each form's breakpoint (1280 for the rail, matching the
// Thread rail; 768 for drawer and popover).

import { useIsMobile } from "@/hooks/use-mobile";
import { useThreadPaneViewport } from "@/hooks/use-thread-pane-viewport";

import { InboxDrawerOverlay } from "./inbox-drawer-overlay";
import { InboxMobileDrawer } from "./inbox-mobile-drawer";
import { InboxPopoverPanel } from "./inbox-popover-panel";
import { useInboxPrototype } from "./inbox-prototype-context";
import { InboxRailPane } from "./inbox-rail-pane";

export function InboxSurface({ threadOpen }: { threadOpen: boolean }) {
  const { variant, isOpen, close } = useInboxPrototype();
  const wideEnoughForRail = useThreadPaneViewport();
  const isMobile = useIsMobile();

  if (!isOpen || variant === "current") return null;

  if (variant === "rail") {
    return wideEnoughForRail ? (
      <InboxRailPane threadOpen={threadOpen} onClosed={close} />
    ) : (
      <InboxMobileDrawer onClosed={close} />
    );
  }

  if (isMobile) return <InboxMobileDrawer onClosed={close} />;

  if (variant === "drawer") return <InboxDrawerOverlay onClosed={close} />;

  return <InboxPopoverPanel onClosed={close} />;
}
