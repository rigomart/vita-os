// PROTOTYPE — throwaway thread-line variant experiment, do not ship
import { cn } from "@vita-os/ui/lib/utils";

/**
 * The `reply` variant's grammar, borrowed from the idiom the app already speaks
 * in `thread-attention.tsx`: an elbow that drops out of the row above and spurs
 * right into the row it belongs to — a comment-tree indent guide, not a rail.
 *
 * The chip becomes a two-message thread: the Thread's title is the parent
 * message, the Next Move is the one reply hanging under it. A chip with no Next
 * Move draws nothing at all — a message with no replies has no thread line.
 */

/**
 * One tone class drives the whole mark: both borders are `currentColor`, so the
 * elbow's vertical guide and its corner can never drift apart. `border` is a
 * translucent white in dark mode, where a 1px line all but disappears — hence
 * the `dark:` step up.
 */
export function replyTone(waiting: boolean): string {
  return waiting
    ? "text-condition-attention"
    : "text-border dark:text-foreground/25";
}

/**
 * The elbow: a `w-px` guide dropping past the parent row's baseline into a
 * rounded corner that points at the reply. Sized for chip density — the same
 * construction as the Up Next elbow, scaled from `h-6 w-3` to `h-[1.125rem]
 * w-2`. Positioned against the reply row, which owns the relative box, so the
 * corner lands on the reply's own centre line whatever the chip above it does.
 */
export function ReplyElbow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-2 h-[1.125rem] w-2 rounded-bl-[4px] border-b border-l border-current",
        className,
      )}
    />
  );
}
