// PROTOTYPE — throwaway thread-line variant experiment, do not ship
import type { Condition } from "@convex/lib/condition";

import { cn } from "@vita-os/ui/lib/utils";

/**
 * A rail drawn as stitches instead of a solid bar: dash length reads as
 * *tension*. Tight, long stitches for a critical Area; loose, sparse ones when
 * everything is fine.
 */
export interface StitchStyle {
  /** SVG `stroke-dasharray`, in px (the SVG has no viewBox: 1 unit = 1px). */
  dash: string;
  /** A `text-*` class — the stroke is `currentColor`. */
  tone: string;
}

export const conditionStitch: Record<Condition, StitchStyle> = {
  critical: { dash: "12 3", tone: "text-condition-critical" },
  needs_attention: { dash: "7 5", tone: "text-condition-attention/70" },
  healthy: { dash: "4 6", tone: "text-border dark:text-foreground/25" },
};

/** Chips have no Condition of their own — only "waiting" or not. */
export const chipStitch: Record<"default" | "waiting", StitchStyle> = {
  waiting: { dash: "7 5", tone: "text-condition-attention" },
  default: { dash: "4 6", tone: "text-border dark:text-foreground/25" },
};

/**
 * Sits in the same absolutely-positioned slot the solid rail span occupies. No
 * `viewBox`, so one user unit is one CSS px and the dash pattern keeps its
 * intended rhythm at any rail height.
 */
export function StitchRail({
  className,
  style,
}: {
  className?: string;
  style: StitchStyle;
}) {
  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute w-[3px]",
        style.tone,
        className,
      )}
    >
      <line
        x1="1.5"
        y1="0"
        x2="1.5"
        y2="100%"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={style.dash}
      />
    </svg>
  );
}

/**
 * Two plies twisted around each other — a repeating diagonal gradient, no SVG.
 * `--ply-b` is the same hue at 45%, so the rail reads as one cord catching the
 * light rather than two stripes.
 */
export function TwistRail({
  className,
  condition,
}: {
  className?: string;
  condition: Condition;
}) {
  const token = plyToken[condition];
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute w-[3px] bg-[repeating-linear-gradient(58deg,var(--ply-a)_0_3px,var(--ply-b)_3px_6px)]",
        className,
      )}
      style={
        {
          "--ply-a": token,
          "--ply-b": `color-mix(in oklch, ${token} 45%, transparent)`,
        } as React.CSSProperties
      }
    />
  );
}

const plyToken: Record<Condition, string> = {
  critical: "var(--condition-critical)",
  needs_attention: "var(--condition-attention)",
  healthy: "var(--border)",
};
