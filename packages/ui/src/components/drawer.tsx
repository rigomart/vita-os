import type * as React from "react";

import { createContext, use, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "../lib/utils";

/**
 * True for anything rendered inside an open drawer. vaul needs a drawer opened
 * from within another to be a `NestedRoot` — otherwise the two fight over the
 * body scroll lock and the background scale — and only the inner component can
 * know, so the outer one publishes the fact.
 */
const InsideDrawerContext = createContext(false);

export function useInsideDrawer() {
  return use(InsideDrawerContext);
}

/**
 * An element inside the open drawer for a popup opened from it to render
 * into. vaul traps focus in the drawer, so a popup portaled to the body could
 * never take focus: its fields would not take a keystroke.
 */
const DrawerPortalContainer = createContext<HTMLElement | null>(null);

export function useDrawerPortalContainer() {
  return use(DrawerPortalContainer);
}

/*
 * vaul's `repositionInputs` lifts the drawer by the keyboard's height when a
 * field takes focus. The host's viewport asks for `interactive-widget=
 * resizes-content`, so the browser already shrinks the page above the
 * keyboard: lifting it again leaves a gap the keyboard's height between
 * them, and vaul then pins the drawer at its keyboard-open height.
 */
function Drawer({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      repositionInputs={repositionInputs}
      {...props}
    />
  );
}

/** A drawer opened from inside another drawer; stacks instead of clashing. */
function DrawerNested({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return (
    <DrawerPrimitive.NestedRoot
      data-slot="drawer"
      repositionInputs={repositionInputs}
      {...props}
    />
  );
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          // vaul's transform and will-change would make the drawer the box a
          // confirmation rendered inside it is fixed to, pinning it off-screen in a
          // short drawer. No swipe can reach the drawer behind one, so drop both.
          "has-data-[slot=alert-dialog-content]:transform-none! has-data-[slot=alert-dialog-content]:will-change-auto!",
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-transparent p-4 text-sm before:absolute before:inset-2 before:-z-10 before:rounded-4xl before:border before:border-border before:bg-popover before:shadow-xl data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          className,
        )}
        onEscapeKeyDown={(event) => {
          // While a popup opened from the drawer is open, Escape closes it alone.
          if (portalContainer?.querySelector("[data-open]")) {
            event.preventDefault();
            return;
          }
          onEscapeKeyDown?.(event);
        }}
        {...props}
      >
        <div
          data-slot="drawer-handle"
          className="mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
        />
        <InsideDrawerContext value={true}>
          <DrawerPortalContainer value={portalContainer}>
            {children}
          </DrawerPortalContainer>
        </InsideDrawerContext>
        <div
          ref={setPortalContainer}
          data-slot="drawer-portal-container"
          className="contents"
        />
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerNested,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
