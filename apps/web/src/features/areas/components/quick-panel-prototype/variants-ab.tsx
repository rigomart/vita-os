// PROTOTYPE — throwaway. Variants A and B of the Area Quick Panel body.
//
// A — "Refined card": the shipped structure, executed with one type scale, a
//     4px spacing rhythm, hairline zone rules, and one action treatment.
// B — "Judgment first": the panel as a Condition instrument — segmented
//     three-way control as the hero, Standard as the reference beneath it.
import type { Condition } from "@convex/lib/condition";
import type { ReactElement } from "react";

import { CONDITIONS, conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { PopoverTitle } from "@vita-os/ui/components/popover";
import { ArrowRight, MessageSquarePlus } from "lucide-react";
import { useRef } from "react";

import {
  conditionDotClassName,
  conditionIcons,
  conditionPillClassName,
} from "@/features/areas/condition-presentation";
import { conditionShort } from "@/features/dashboard/plan/plan-model";
import { cn } from "@/lib/utils";

import type { PanelVariantProps } from "./prototype";

import { AreaConditionSelect } from "../area-condition-select";

/** Both variants share one width, so A and B can be flipped between fairly. */
const PANEL_WIDTH = "w-[21rem]";

/** One eyebrow treatment, used for every small label in both variants. */
const EYEBROW =
  "font-heading text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

/**
 * The one action treatment: a quiet full-width row. Both actions in both
 * variants use it, so nothing in the footer looks more important than its
 * neighbour by accident.
 */
const ACTION_ROW =
  "h-9 w-full justify-start gap-2.5 rounded-xl px-2.5 text-sm font-medium [&_svg]:text-muted-foreground";

function StandardBody({
  className,
  standard,
}: {
  className?: string;
  standard?: string;
}): ReactElement {
  if (!standard) {
    return (
      <p className={cn("text-sm text-muted-foreground/70 italic", className)}>
        No Standard yet — write it on the Area page.
      </p>
    );
  }
  return (
    <p
      className={cn(
        "text-sm leading-relaxed whitespace-pre-line text-foreground/85",
        className,
      )}
    >
      {standard}
    </p>
  );
}

// ---------------------------------------------------------------------------
// A — Refined card
// ---------------------------------------------------------------------------

export function VariantA({
  area,
  onClose,
  onNewThread,
  setCondition,
}: PanelVariantProps): ReactElement {
  return (
    // 4px grid throughout: 16px gutters, 12/16px zone padding, 8px stacks.
    <div className={cn(PANEL_WIDTH, "flex flex-col divide-y divide-border")}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <PopoverTitle className="truncate font-heading text-base leading-6 font-semibold tracking-tight">
          {area.name}
        </PopoverTitle>
        <AreaConditionSelect
          condition={area.condition}
          label={`Condition for ${area.name}`}
          onConditionChange={setCondition}
        />
      </header>

      <section className="flex flex-col gap-2 px-4 py-4">
        <h3 className={EYEBROW}>Standard</h3>
        <StandardBody standard={area.standard} />
      </section>

      <PanelActions area={area} onClose={onClose} onNewThread={onNewThread} />
    </div>
  );
}

/** The two actions, one treatment, shared by both variants. */
function PanelActions({
  area,
  className,
  onClose,
  onNewThread,
}: {
  area: PanelVariantProps["area"];
  className?: string;
  onClose: () => void;
  onNewThread: () => void;
}): ReactElement {
  return (
    <footer className={cn("flex flex-col gap-0.5 p-2", className)}>
      <Button variant="ghost" className={ACTION_ROW} onClick={onNewThread}>
        <MessageSquarePlus />
        <span className="truncate">New Thread in {area.name}</span>
      </Button>
      <Button
        variant="ghost"
        className={ACTION_ROW}
        render={
          <Link
            to="/$areaSlug"
            params={{ areaSlug: area.slug }}
            onClick={onClose}
          />
        }
      >
        <ArrowRight />
        <span className="truncate">Open {area.name}</span>
      </Button>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// B — Judgment first
// ---------------------------------------------------------------------------

/**
 * Three equal segments, one per Condition, with radiogroup semantics: a single
 * tab stop, arrows move and select, and the active segment carries the vivid
 * fill plus its icon and label (never colour alone — ADR 0008).
 */
function ConditionSegments({
  area,
  setCondition,
}: {
  area: PanelVariantProps["area"];
  setCondition: (condition: Condition) => void;
}): ReactElement {
  const segments = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + CONDITIONS.length) % CONDITIONS.length;
    setCondition(CONDITIONS[next]!);
    segments.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={`Condition for ${area.name}`}
      className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-1 p-1 ring-1 ring-border ring-inset"
    >
      {CONDITIONS.map((condition, index) => {
        const Icon = conditionIcons[condition];
        const active = area.condition === condition;
        return (
          <button
            key={condition}
            ref={(node) => {
              segments.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={conditionLabels[condition]}
            tabIndex={active ? 0 : -1}
            onClick={() => setCondition(condition)}
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
              "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-2xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              active
                ? conditionPillClassName[condition]
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {conditionShort[condition]}
          </button>
        );
      })}
    </div>
  );
}

export function VariantB({
  area,
  onClose,
  onNewThread,
  setCondition,
}: PanelVariantProps): ReactElement {
  return (
    <div className={cn(PANEL_WIDTH, "flex flex-col")}>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              conditionDotClassName[area.condition],
            )}
          />
          <PopoverTitle className={cn(EYEBROW, "truncate")}>
            {area.name}
          </PopoverTitle>
        </div>

        <ConditionSegments area={area} setCondition={setCondition} />
      </div>

      <section className="flex flex-col gap-2 px-4 pb-4">
        <h3 className={EYEBROW}>Standard</h3>
        <blockquote className="border-l-2 border-border pl-3">
          <StandardBody
            className="text-muted-foreground italic"
            standard={area.standard}
          />
        </blockquote>
      </section>

      <PanelActions
        area={area}
        className="border-t border-border bg-surface-1"
        onClose={onClose}
        onNewThread={onNewThread}
      />
    </div>
  );
}
