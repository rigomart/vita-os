import type { ComponentProps, ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";

/**
 * Needs a `group/row` ancestor. A touch screen has no hover, so there the
 * commands are always shown.
 */
export const revealed =
  "xl:opacity-0 xl:group-focus-within/row:opacity-100 xl:group-hover/row:opacity-100 xl:data-popup-open:opacity-100 xl:pointer-coarse:opacity-100";

export const commandButtonClassName =
  "flex size-8 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-popup-open:bg-muted data-popup-open:text-foreground motion-reduce:transition-none xl:size-7 [&_svg]:size-3.5";

export const completeCommandClassName =
  "bg-foreground/8 text-muted-foreground hover:bg-condition-healthy/15 hover:text-condition-healthy";

export function Command({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function CommandButton({
  className,
  children,
  onClickCapture,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(commandButtonClassName, className)}
      {...props}
      onClickCapture={(event) => {
        if (props["aria-disabled"]) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClickCapture?.(event);
      }}
    >
      {children}
    </button>
  );
}
