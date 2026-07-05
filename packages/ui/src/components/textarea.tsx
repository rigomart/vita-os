import type * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const textareaVariants = cva(
  "flex w-full resize-none outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "field-sizing-content min-h-16 rounded-2xl border border-transparent bg-input/50 px-3 py-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        inline:
          "h-auto rounded-none border-0 bg-transparent px-0 py-0 text-inherit font-inherit leading-inherit tracking-inherit shadow-none focus-visible:ring-0 focus-visible:outline-none aria-invalid:ring-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
