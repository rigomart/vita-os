// PROTOTYPE — throwaway. Variants C and D of the Area Quick Panel body.
//
// C — "Reference sheet": the panel is the Area's index card. The Standard is
//     the hero, set as editorial body copy; Condition and the two actions sit
//     under it as quiet utility.
// D — "Action list": the panel is a menu. A slim header, then one column of
//     equal-height rows — the three Conditions, then the two actions — with
//     the Standard as fine print at the foot.
import type { Condition } from "@convex/lib/condition";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { CONDITION_OPTIONS, conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { PopoverTitle } from "@vita-os/ui/components/popover";
import { ArrowRight, Check, MessageSquarePlus } from "lucide-react";

import {
  conditionDotClassName,
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { PanelVariantProps } from "./prototype";

import { AreaConditionSelect } from "../area-condition-select";

const STANDARD_EMPTY = "No Standard yet — write it on the Area page.";

/** One focus treatment, so every affordance in both variants rings the same. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover";

// ---------------------------------------------------------------------------
// C — Reference sheet
// ---------------------------------------------------------------------------

export function VariantC({
  area,
  setCondition,
  onNewThread,
  onClose,
}: PanelVariantProps): ReactElement {
  return (
    <div className="flex w-[21.5rem] flex-col">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <PopoverTitle className="font-heading text-[0.9375rem] leading-5 font-semibold tracking-tight">
            {area.name}
          </PopoverTitle>
          <ConditionMarker condition={area.condition} />
        </div>

        {area.standard ? (
          <p className="mt-3.5 text-[0.9375rem] leading-6 whitespace-pre-line text-foreground/85">
            {area.standard}
          </p>
        ) : (
          <p className="mt-3.5 text-[0.9375rem] leading-6 text-muted-foreground/70 italic">
            {STANDARD_EMPTY}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-1 px-5 py-3">
        <span className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Condition
        </span>
        <AreaConditionSelect
          condition={area.condition}
          label={`Condition for ${area.name}`}
          onConditionChange={setCondition}
        />
      </div>

      <div className="flex flex-col items-start gap-2.5 border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={onNewThread}
          className={cn(
            "rounded-sm text-sm font-medium text-brand-accent-foreground underline-offset-4 hover:underline",
            FOCUS_RING,
          )}
        >
          New Thread in {area.name}
        </button>
        <Link
          to="/$areaSlug"
          params={{ areaSlug: area.slug }}
          onClick={onClose}
          className={cn(
            "group flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
            FOCUS_RING,
          )}
        >
          Open {area.name}
          <ArrowRight
            aria-hidden
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}

/** Dot plus word — colour is never the only signal (ADR 0008). */
function ConditionMarker({ condition }: { condition: Condition }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-2xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          conditionDotClassName[condition],
        )}
      />
      {conditionLabels[condition]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// D — Action list
// ---------------------------------------------------------------------------

/** Every row in D: one height, one icon column, one hover treatment. */
const ROW =
  "flex h-9 w-full items-center gap-2.5 rounded-2xl px-2.5 text-sm font-medium [&_svg]:size-4 [&_svg]:shrink-0";
const ROW_INTERACTIVE = cn(
  ROW,
  "text-left hover:bg-accent focus-visible:bg-accent",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
);

export function VariantD({
  area,
  setCondition,
  onNewThread,
  onClose,
}: PanelVariantProps): ReactElement {
  const CurrentIcon: LucideIcon = conditionIcons[area.condition];

  return (
    <div className="flex w-[19.5rem] flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <PopoverTitle className="truncate font-heading text-sm font-semibold tracking-tight">
          {area.name}
        </PopoverTitle>
        <span className="flex shrink-0 items-center gap-1.5 text-2xs font-medium text-muted-foreground">
          <CurrentIcon
            aria-hidden
            className={cn("size-3.5", conditionTextClassName[area.condition])}
          />
          {conditionLabels[area.condition]}
        </span>
      </div>

      <div className="flex flex-col px-1.5 pb-1.5">
        {CONDITION_OPTIONS.map((option) => {
          const Icon = conditionIcons[option.value];
          const current = option.value === area.condition;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={current}
              onClick={current ? undefined : () => setCondition(option.value)}
              className={cn(
                current
                  ? cn(
                      ROW,
                      "cursor-default text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    )
                  : ROW_INTERACTIVE,
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  conditionTextClassName[option.value],
                  !current && "opacity-70",
                )}
              />
              <span className="truncate">Set to {option.label}</span>
              {current ? (
                <Check aria-hidden className="ml-auto text-muted-foreground" />
              ) : null}
            </button>
          );
        })}

        <div aria-hidden className="my-1.5 h-px bg-border" />

        <button type="button" onClick={onNewThread} className={ROW_INTERACTIVE}>
          <MessageSquarePlus aria-hidden className="text-muted-foreground" />
          <span className="truncate">New Thread in {area.name}</span>
        </button>

        <Link
          to="/$areaSlug"
          params={{ areaSlug: area.slug }}
          onClick={onClose}
          className={ROW_INTERACTIVE}
        >
          <ArrowRight aria-hidden className="text-muted-foreground" />
          <span className="truncate">Open {area.name}</span>
        </Link>
      </div>

      <div className="border-t border-border bg-surface-1 px-4 py-3">
        <p className="text-2xs font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
          Standard
        </p>
        {area.standard ? (
          <p
            title={area.standard}
            className="mt-1 line-clamp-3 text-xs leading-5 whitespace-pre-line text-muted-foreground"
          >
            {area.standard}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-5 text-muted-foreground/70 italic">
            {STANDARD_EMPTY}
          </p>
        )}
      </div>
    </div>
  );
}
