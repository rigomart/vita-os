import type { Condition } from "@convex/lib/condition";

import { CONDITION_OPTIONS, isCondition } from "@convex/lib/condition";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";

import {
  conditionIcons,
  conditionPillClassName,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

export function ConditionStateIcon({
  condition,
  className,
}: {
  condition: Condition;
  className?: string;
}) {
  const Icon = conditionIcons[condition];
  return <Icon aria-hidden className={className} />;
}

/**
 * The Condition pill — the one control that changes an Area's Condition,
 * wherever the Area is on screen.
 *
 * It always carries the state icon beside the label: the fill is a second
 * signal, never the only one, so the pill still reads for anyone who cannot
 * separate the three fills by colour.
 */
export function AreaConditionSelect({
  condition,
  onConditionChange,
  className,
  label = "Area condition",
}: {
  className?: string;
  condition: Condition;
  /** The trigger's accessible name; distinguish it when several are on screen. */
  label?: string;
  onConditionChange: (value: Condition) => void;
}) {
  return (
    <Select
      items={CONDITION_OPTIONS}
      value={condition}
      onValueChange={(value) => {
        if (isCondition(value)) onConditionChange(value);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-auto gap-1.5 border px-2.5 text-xs font-medium [&_svg]:text-current",
          conditionPillClassName[condition],
          className,
        )}
        aria-label={label}
      >
        <ConditionStateIcon condition={condition} className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {CONDITION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <ConditionStateIcon
                  condition={option.value}
                  className={cn("size-4", conditionTextClassName[option.value])}
                />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
