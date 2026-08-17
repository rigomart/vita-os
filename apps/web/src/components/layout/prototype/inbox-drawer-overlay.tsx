// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Form "drawer": a right-side sheet at z-50, so it overlays everything —
// including an open Thread rail — and dismisses the usual ways (backdrop click,
// Escape, close button). Nothing under it moves.

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@vita-os/ui/components/sheet";

import { useDeferredRouteClose } from "@/features/threads/thread-detail/use-deferred-route-close";

import { InboxSurfaceBody } from "./inbox-surface-body";

export function InboxDrawerOverlay({ onClosed }: { onClosed: () => void }) {
  // Same deferred close as the rail: the search param is only dropped once the
  // sheet has finished sliding out, so this form animates instead of popping.
  const { open, requestClose, handleOpenChange, completeOpenChange } =
    useDeferredRouteClose(onClosed);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* The base sheet's own `data-[side=right]:` rules outrank a plain
          `w-*`/`max-w-*`, so the override has to carry the same variant. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[min(34rem,max(28rem,34vw))]"
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !open) {
            completeOpenChange(false);
          }
        }}
      >
        <SheetTitle className="sr-only">Inbox</SheetTitle>
        <SheetDescription className="sr-only">
          Process the Tasks waiting in your Inbox.
        </SheetDescription>
        <InboxSurfaceBody onClose={requestClose} />
      </SheetContent>
    </Sheet>
  );
}
