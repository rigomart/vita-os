// PROTOTYPE — throwaway thread-line variant experiment, do not ship

import { cn } from "@vita-os/ui/lib/utils";

/**
 * A vertical running stitch in the day-cell gutter. Because the chips carry an
 * opaque `bg-surface-2` surface, the dashed line reads as thread diving under
 * each chip and re-emerging below it.
 *
 * Mount requirements: the parent day-cell wrapper must be `relative`, and the
 * chips inside it must sit at a higher stacking level than this span (it is
 * `z-0`, so give the chips `relative z-10` or similar). Purely decorative —
 * no animation, no state, one span.
 */
export function LaceOverlay({
  leftClassName = "left-[11px]",
  tone = "text-border/60 dark:text-foreground/15",
}: {
  /** Horizontal placement of the stitch gutter. */
  leftClassName?: string;
  /** `currentColor` source for the stitch — the gradient inherits it. */
  tone?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 z-0 w-[3px]",
        leftClassName,
        tone,
        "bg-[repeating-linear-gradient(to_bottom,currentColor_0_7px,transparent_7px_12px)]",
      )}
    />
  );
}
