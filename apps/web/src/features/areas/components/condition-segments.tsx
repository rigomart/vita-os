import type { Condition } from "@convex/lib/condition";

import { CONDITIONS, conditionLabels } from "@convex/lib/condition";
import { useRef } from "react";

import {
  conditionIcons,
  conditionPillClassName,
  conditionShort,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/**
 * The Condition as a segmented control: all three states visible at once,
 * one tap to re-judge. Radiogroup semantics — a single tab stop, arrow keys
 * move and select. Every segment carries its state icon and short label, so
 * the active segment's vivid fill is a second signal, never the only one
 * (ADR 0008).
 */
export function ConditionSegments({
  condition,
  label = "Area condition",
  onConditionChange,
  className,
}: {
  className?: string;
  condition: Condition;
  /** The group's accessible name; distinguish it when several are on screen. */
  label?: string;
  onConditionChange: (value: Condition) => void;
}) {
  const segments = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + CONDITIONS.length) % CONDITIONS.length;
    onConditionChange(CONDITIONS[next]!);
    segments.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full gap-0.5 rounded-lg bg-surface-1 p-0.5 ring-1 ring-border ring-inset",
        className,
      )}
    >
      {CONDITIONS.map((value, index) => {
        const Icon = conditionIcons[value];
        const active = condition === value;
        return (
          <button
            key={value}
            ref={(node) => {
              segments.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={conditionLabels[value]}
            tabIndex={active ? 0 : -1}
            onClick={() => onConditionChange(value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[0.4375rem] px-2 text-2xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? conditionPillClassName[value]
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {conditionShort[value]}
          </button>
        );
      })}
    </div>
  );
}
