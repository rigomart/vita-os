import type { AreaIcon as AreaIconName } from "@convex/lib/areaIcons";

import { AREA_ICONS, areaIconLabels } from "@convex/lib/areaIcons";

import { cn } from "@/lib/utils";

import { AreaIcon } from "./area-icon";

interface AreaIconPickerProps {
  selectedIcon: AreaIconName;
  onSelect: (icon: AreaIconName) => void;
  disabled?: boolean;
}

export function AreaIconPicker({
  selectedIcon,
  onSelect,
  disabled = false,
}: AreaIconPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-2" aria-label="Area icon">
      {AREA_ICONS.map((icon) => {
        const selected = icon === selectedIcon;
        return (
          <button
            key={icon}
            type="button"
            aria-label={areaIconLabels[icon]}
            aria-pressed={selected}
            title={areaIconLabels[icon]}
            disabled={disabled}
            onClick={() => onSelect(icon)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
              selected &&
                "bg-surface-3 text-foreground ring-1 ring-foreground/15",
            )}
          >
            <AreaIcon icon={icon} className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
