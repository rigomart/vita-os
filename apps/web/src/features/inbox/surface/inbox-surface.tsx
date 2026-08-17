import { useIsMobile } from "@/hooks/use-mobile";

import { InboxMobileDrawer } from "./inbox-mobile-drawer";
import { InboxPopoverPanel } from "./inbox-popover-panel";
import { useInboxSurface } from "./use-inbox-surface";
import { useSurfacePresence } from "./use-surface-presence";

/**
 * The summoned Inbox: a popover panel hanging off the top bar on a pointer-sized
 * viewport, a bottom drawer on a phone. The switch follows `useIsMobile` (768px),
 * not the thread pane's own 1280px breakpoint — this panel is narrow enough to
 * sit beside any page.
 */
export function InboxSurface() {
  const { isOpen, close } = useInboxSurface();
  const { mounted, open, handleExited } = useSurfacePresence(isOpen);
  const isMobile = useIsMobile();

  if (!mounted) return null;

  return isMobile ? (
    <InboxMobileDrawer open={open} onClose={close} onExited={handleExited} />
  ) : (
    <InboxPopoverPanel open={open} onClose={close} onExited={handleExited} />
  );
}
