// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Shared small-screen fallback for all three candidate forms: a bottom drawer
// at 90dvh, matching the Thread detail drawer.

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@vita-os/ui/components/drawer";

import { useDeferredRouteClose } from "@/features/threads/thread-detail/use-deferred-route-close";

import { InboxSurfaceBody } from "./inbox-surface-body";

export function InboxMobileDrawer({ onClosed }: { onClosed: () => void }) {
  const { open, requestClose, handleOpenChange, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  return (
    <Drawer
      open={open}
      direction="bottom"
      onOpenChange={handleOpenChange}
      onAnimationEnd={completeOpenChange}
    >
      <DrawerContent
        className="h-[90dvh] max-h-[90dvh] p-0 before:inset-0 before:rounded-t-4xl data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
        onAnimationEndCapture={(event) => {
          if (
            event.target === event.currentTarget &&
            event.currentTarget.dataset.state === "closed"
          ) {
            completeOpenChange(false);
          }
        }}
      >
        <DrawerTitle className="sr-only">Inbox</DrawerTitle>
        <DrawerDescription className="sr-only">
          Process the Tasks waiting in your Inbox.
        </DrawerDescription>
        <InboxSurfaceBody
          onClose={requestClose}
          className="pt-2"
          bodyClassName="pb-[calc(1rem+env(safe-area-inset-bottom))]"
        />
      </DrawerContent>
    </Drawer>
  );
}
