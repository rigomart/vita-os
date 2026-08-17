// PROTOTYPE — throwaway. Variant A of the Area Quick Panel body, plus two
// adjusted takes on the same structure:
//
// A  — "Refined card": the reference. Header (name + Condition pill select),
//      Standard zone, footer of two ghost action rows.
// A2 — "Linked title, header segments": the title is the Area link (trailing
//      up-right arrow, hover underline); a compact icon-led segmented control
//      replaces the select, sitting in the header row; footer keeps only
//      New Thread.
// A3 — "Linked title, segment strip": same linked title, with the segmented
//      control as a labeled full-width strip under the header instead.
import type { Condition } from "@convex/lib/condition";
import type { ReactElement } from "react";

import { CONDITIONS, conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { PopoverTitle } from "@vita-os/ui/components/popover";
import { ArrowRight, ArrowUpRight, MessageSquarePlus } from "lucide-react";
import { useRef } from "react";

import {
  conditionIcons,
  conditionPillClassName,
} from "@/features/areas/condition-presentation";
import { conditionShort } from "@/features/dashboard/plan/plan-model";
import { cn } from "@/lib/utils";

import type { PanelVariantProps } from "./prototype";

import { AreaConditionSelect } from "../area-condition-select";

/** All takes share one width, so they can be flipped between fairly. */
const PANEL_WIDTH = "w-[21rem]";

/** One eyebrow treatment, used for every small label in every take. */
const EYEBROW =
  "font-heading text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase";

/** The one action treatment: a quiet full-width row. */
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

/**
 * The title as the way to the Area page: a trailing up-right arrow marks the
 * jump, and hovering underlines the name so the affordance is discoverable
 * without a dedicated row.
 */
function TitleLink({
  area,
  onClose,
}: {
  area: PanelVariantProps["area"];
  onClose: () => void;
}): ReactElement {
  return (
    <PopoverTitle className="min-w-0 truncate font-heading text-base leading-6 font-semibold tracking-tight">
      <Link
        to="/$areaSlug"
        params={{ areaSlug: area.slug }}
        onClick={onClose}
        className="group inline-flex max-w-full items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
      >
        <span className="truncate underline-offset-4 group-hover:underline">
          {area.name}
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
        />
      </Link>
    </PopoverTitle>
  );
}

/**
 * Compact segmented Condition control with radiogroup semantics: one tab
 * stop, arrows move and select. Inactive segments show only their state icon
 * (the icons differ per Condition, so colour is never the lone signal —
 * ADR 0008); the active segment carries the vivid fill plus its short label.
 */
function CompactConditionSegments({
  area,
  grow,
  setCondition,
}: {
  area: PanelVariantProps["area"];
  /** Stretch segments to equal thirds (the strip form). */
  grow?: boolean;
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
      className={cn(
        "flex shrink-0 gap-0.5 rounded-lg bg-surface-1 p-0.5 ring-1 ring-border ring-inset",
        grow && "w-full",
      )}
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
              "flex h-7 items-center justify-center gap-1.5 rounded-[0.4375rem] text-2xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              grow ? "flex-1 px-2" : "px-2",
              active
                ? conditionPillClassName[condition]
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {(active || grow) && conditionShort[condition]}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A — Refined card (the reference)
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

      <footer className="flex flex-col gap-0.5 p-2">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// A2 — Linked title, header segments
// ---------------------------------------------------------------------------

export function VariantA2({
  area,
  onClose,
  onNewThread,
  setCondition,
}: PanelVariantProps): ReactElement {
  return (
    <div className={cn(PANEL_WIDTH, "flex flex-col divide-y divide-border")}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <TitleLink area={area} onClose={onClose} />
        <CompactConditionSegments area={area} setCondition={setCondition} />
      </header>

      <section className="flex flex-col gap-2 px-4 py-4">
        <h3 className={EYEBROW}>Standard</h3>
        <StandardBody standard={area.standard} />
      </section>

      <footer className="p-2">
        <Button variant="ghost" className={ACTION_ROW} onClick={onNewThread}>
          <MessageSquarePlus />
          <span className="truncate">New Thread in {area.name}</span>
        </Button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A3 — Linked title, segment strip
// ---------------------------------------------------------------------------

export function VariantA3({
  area,
  onClose,
  onNewThread,
  setCondition,
}: PanelVariantProps): ReactElement {
  return (
    <div className={cn(PANEL_WIDTH, "flex flex-col divide-y divide-border")}>
      <header className="flex flex-col gap-2.5 px-4 pt-3 pb-3.5">
        <TitleLink area={area} onClose={onClose} />
        <CompactConditionSegments
          area={area}
          grow
          setCondition={setCondition}
        />
      </header>

      <section className="flex flex-col gap-2 px-4 py-4">
        <h3 className={EYEBROW}>Standard</h3>
        <StandardBody standard={area.standard} />
      </section>

      <footer className="p-2">
        <Button variant="ghost" className={ACTION_ROW} onClick={onNewThread}>
          <MessageSquarePlus />
          <span className="truncate">New Thread in {area.name}</span>
        </Button>
      </footer>
    </div>
  );
}
