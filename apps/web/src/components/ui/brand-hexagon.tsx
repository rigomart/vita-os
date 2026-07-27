import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const hexagonClipPath =
  "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)";

export function BrandHexagon({
  children,
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ clipPath: hexagonClipPath }}
      {...props}
    >
      {children}
    </span>
  );
}
