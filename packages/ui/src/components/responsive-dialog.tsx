import { createContext, type ReactNode, use } from "react";

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

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const insideDrawer = useInsideDrawer();
  const content = <MobileContext value={isMobile}>{children}</MobileContext>;

  if (isMobile) {
    // Opened from inside a drawer — the Inbox surface on a phone — this has to
    // be a nested root, or the two drawers fight over the body scroll lock.
    const DrawerRoot = insideDrawer ? DrawerNested : Drawer;
    return (
      <DrawerRoot open={open} onOpenChange={onOpenChange}>
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
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = use(MobileContext);

  if (isMobile) {
    // `surface` is a desktop concern: a drawer is anchored to the screen edge.
    return (
      <DrawerContent className={cn(className)}>
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
