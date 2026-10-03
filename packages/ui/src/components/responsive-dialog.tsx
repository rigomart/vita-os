import { createContext, type ReactNode, use, useRef } from "react";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  Drawer,
  DrawerNested,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  useInsideDrawer,
} from "./drawer";

const MobileContext = createContext(false);
const DrawerDismissalContext = createContext({
  guarded: false,
  requestClose: () => {},
});

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  guardDrawerClose = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Route dismissal attempts to the owner before Vaul moves the drawer. */
  guardDrawerClose?: boolean;
}) {
  const isMobile = useIsMobile();
  const insideDrawer = useInsideDrawer();
  const content = (
    <DrawerDismissalContext
      value={{
        guarded: guardDrawerClose,
        requestClose: () => onOpenChange?.(false),
      }}
    >
      <MobileContext value={isMobile}>{children}</MobileContext>
    </DrawerDismissalContext>
  );

  if (isMobile) {
    // Opened from inside a drawer — the Thread drawer on a phone — this has to
    // be a nested root, or the two drawers fight over the body scroll lock.
    const DrawerRoot = insideDrawer ? DrawerNested : Drawer;
    return (
      <DrawerRoot
        open={open}
        onOpenChange={onOpenChange}
        dismissible={!guardDrawerClose}
      >
        {content}
      </DrawerRoot>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
}

function ResponsiveDialogContent({
  showCloseButton,
  surface,
  className,
  children,
  onEscapeKeyDown,
}: React.ComponentProps<typeof DialogContent> & {
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}) {
  const isMobile = use(MobileContext);
  const { guarded, requestClose } = use(DrawerDismissalContext);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const insideConfirmation = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest(
      '[data-slot="alert-dialog-content"], [data-slot="alert-dialog-overlay"]',
    );

  if (isMobile) {
    // `surface` is a desktop concern: a drawer is anchored to the screen edge.
    return (
      <DrawerContent
        className={cn(className)}
        onEscapeKeyDown={(event) => {
          // These modal libraries track focus separately, so Escape can still
          // target the drawer while its confirmation is open in another portal.
          // Prevent Radix dismissal and let Base UI cancel the confirmation.
          if (
            insideConfirmation(event.target) ||
            document.querySelector(
              '[data-slot="alert-dialog-content"][data-open]',
            )
          ) {
            event.preventDefault();
            return;
          }
          onEscapeKeyDown?.(event);
          if (guarded && !event.defaultPrevented) {
            event.preventDefault();
            requestClose();
          }
        }}
        onPointerDownOutside={(event) => {
          if (insideConfirmation(event.target)) {
            event.preventDefault();
            return;
          }
          if (guarded) {
            event.preventDefault();
            requestClose();
          }
        }}
        onInteractOutside={(event) => {
          // Base UI confirmations use their own portal outside Radix's drawer.
          // Interacting with that confirmation must not dismiss its owner.
          if (insideConfirmation(event.target)) event.preventDefault();
        }}
        onPointerDownCapture={(event) => {
          // Vaul animates a completed swipe before asking the controlled owner
          // to close. A guarded header gesture asks first and leaves it in place.
          swipeStart.current = null;
          if (
            !guarded ||
            event.button !== 0 ||
            !(event.target instanceof Element)
          )
            return;
          if (
            !event.target.closest(
              '[data-slot="drawer-header"], [data-slot="drawer-handle"]',
            ) ||
            event.target.closest(
              'button, a, input, textarea, select, [role="button"]',
            )
          )
            return;
          swipeStart.current = { x: event.clientX, y: event.clientY };
          if (event.pointerId !== undefined)
            event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUpCapture={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!guarded || !start) return;
          const deltaY = event.clientY - start.y;
          if (deltaY > 60 && deltaY > Math.abs(event.clientX - start.x))
            requestClose();
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        <div className="flex flex-col gap-4 overflow-y-auto p-4 pt-0">
          {children}
        </div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      surface={surface}
      className={className}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") onEscapeKeyDown?.(event.nativeEvent);
      }}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    return <DrawerHeader className={cn("p-0", className)} {...props} />;
  }

  return <DialogHeader className={className} {...props} />;
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    return (
      <DrawerTitle
        className={cn(className)}
        {...(props as React.ComponentProps<typeof DrawerTitle>)}
      />
    );
  }

  return <DialogTitle className={className} {...props} />;
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    return (
      <DrawerDescription
        className={cn(className)}
        {...(props as React.ComponentProps<typeof DrawerDescription>)}
      />
    );
  }

  return <DialogDescription className={className} {...props} />;
}

function ResponsiveDialogFooter({
  showCloseButton,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    return (
      <DrawerFooter className={cn("p-0", className)} {...props}>
        {children}
      </DrawerFooter>
    );
  }

  return (
    <DialogFooter
      showCloseButton={showCloseButton}
      className={className}
      {...props}
    >
      {children}
    </DialogFooter>
  );
}

function ResponsiveDialogClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    return (
      <DrawerClose {...(props as React.ComponentProps<typeof DrawerClose>)} />
    );
  }

  return <DialogClose {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
