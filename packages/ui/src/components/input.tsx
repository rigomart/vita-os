import type * as React from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const inputVariants = cva(
  "w-full min-w-0 outline-none transition-[color,box-shadow,background-color] file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "h-9 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base file:h-7 file:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        inline:
          "h-auto rounded-none border-0 bg-transparent px-0 py-0 text-inherit font-inherit leading-inherit tracking-inherit shadow-none focus-visible:ring-0 focus-visible:outline-none aria-invalid:ring-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Input({
  className,
  type,
  variant = "default",
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
