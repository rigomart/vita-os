// PROTOTYPE — area quick-switcher variant C: disclosure chevron on the area
// title opening an area-jump popover. Throwaway; see use-area-switcher-variant.
import type { ProjectedArea } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Check, ChevronsUpDown, LayoutDashboard } from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

function ConditionMark({
  condition,
}: {
  condition: ProjectedArea["condition"];
}) {
  // Only the two states that ask for something get a mark — a check beside
  // every healthy Area would be noise, and would fight the current-Area check.
  if (condition === "healthy") return null;
  const Icon = conditionIcons[condition];
  return (
    <Icon
      aria-hidden
      className={cn("size-3.5 shrink-0", conditionTextClassName[condition])}
    />
  );
}

export function AreaTitleSwitcher({
  currentArea,
}: {
  currentArea: ProjectedArea;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Subscribe only while the popover is open, like the command palette does.
  const areas = useQuery(api.areas.list, open ? {} : "skip");

  const goToArea = (area: ProjectedArea) => {
    setOpen(false);
    if (area._id === currentArea._id) return;
    void navigate({ to: "/$areaSlug", params: { areaSlug: area.slug } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Switch area"
            // Quieter and smaller than the size-9 icon picker on the other
            // side of the title, so the header row keeps its height.
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <ChevronsUpDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-60 gap-0 p-1" align="start">
        {/* Names the list so the chevron cannot be read as expand/collapse. */}
        <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
          Switch area
        </p>
        {areas === undefined ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
        ) : (
          areas.map((area) => {
            const isCurrent = area._id === currentArea._id;
            return (
              <button
                key={area._id}
                type="button"
                onClick={() => goToArea(area)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-3",
                  isCurrent && "font-medium",
                )}
              >
                <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{area.name}</span>
                <ConditionMark condition={area.condition} />
                {isCurrent && (
                  <Check aria-hidden className="size-3.5 shrink-0" />
                )}
              </button>
            );
          })
        )}
        <div className="mt-1 border-t border-border pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/" });
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <LayoutDashboard aria-hidden className="size-3.5 shrink-0" />
            Dashboard
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
