import { createContext, type ReactNode, use } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const content = <MobileContext value={isMobile}>{children}</MobileContext>;
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {content}
      </Drawer>
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
  className,
  children,
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = use(MobileContext);
  if (isMobile) {
    return (
      <DrawerContent className={className}>
        <div className="flex flex-col gap-4 overflow-y-auto p-4 pt-0">
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent showCloseButton={showCloseButton} className={className}>
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
        className={className}
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
        className={className}
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
