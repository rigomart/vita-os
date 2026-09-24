import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";

import { InboxSurfaceBody } from "./inbox-surface-body";

interface InboxMobileDrawerProps {
  /** False while the drawer animates out; it unmounts on `onExited`. */
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}

/** The phone-sized Inbox: a bottom drawer, matching the Thread detail drawer. */
export function InboxMobileDrawer({
  open,
  onClose,
  onExited,
}: InboxMobileDrawerProps) {
  return (
    <Drawer
      open={open}
      direction="bottom"
      autoFocus
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      onAnimationEnd={(nextOpen) => {
        if (!nextOpen) onExited();
      }}
    >
      <DrawerContent
        className="h-[90dvh] max-h-[90dvh] p-0 before:inset-0 before:rounded-t-4xl data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        onAnimationEndCapture={(event) => {
          if (
            event.target === event.currentTarget &&
            event.currentTarget.dataset.state === "closed"
          ) {
            onExited();
          }
        }}
      >
        <DrawerTitle className="sr-only">Notes</DrawerTitle>
        <DrawerDescription className="sr-only">
          Your standalone Notes and completed history.
        </DrawerDescription>
        <InboxSurfaceBody
          onClose={onClose}
          className="pt-2"
          bodyClassName="pb-[calc(1rem+env(safe-area-inset-bottom))]"
        />
      </DrawerContent>
    </Drawer>
  );
}
