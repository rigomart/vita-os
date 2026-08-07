// PROTOTYPE — throwaway. Variant C's replacement for AreaConditionOverview:
// the card grid collapses to one dense line. Non-healthy Areas keep a named,
// condition-coloured link; healthy Areas shrink to a "N steady" tally with
// glyph links. Same tokens and wording as area-condition-overview.tsx.
import { Link } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";

const attentionLabels: Partial<Record<DashboardArea["condition"], string>> = {
  critical: "Needs you",
  needs_attention: "Watch",
};

function byOrder(a: DashboardArea, b: DashboardArea) {
  return a.order - b.order;
}

export function ConditionStrip({ areas }: { areas: DashboardArea[] }) {
  const critical = areas
    .filter((area) => area.condition === "critical")
    .sort(byOrder);
  const attention = areas
    .filter((area) => area.condition === "needs_attention")
    .sort(byOrder);
  const healthy = areas
    .filter((area) => area.condition === "healthy")
    .sort(byOrder);
  const prominent = [...critical, ...attention];

  return (
    <div
      aria-label="Life Areas by condition"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      {prominent.map((area) => {
        const StateIcon = conditionIcons[area.condition];
        return (
          <Link
            key={area.id}
            to="/$areaSlug"
            params={{ areaSlug: area.slug }}
            className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-muted/40 pr-2.5 pl-2 text-xs transition-colors hover:bg-muted/70"
          >
            <StateIcon
              aria-hidden
              className={cn(
                "size-3.5 shrink-0",
                conditionTextClassName[area.condition],
              )}
            />
            <span className="truncate font-semibold">{area.name}</span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-medium",
                conditionTextClassName[area.condition],
              )}
            >
              {attentionLabels[area.condition]}
            </span>
          </Link>
        );
      })}

      {prominent.length === 0 && (
        <span className="text-xs text-muted-foreground">All areas steady.</span>
      )}

      {healthy.length > 0 && (
        <>
          {prominent.length > 0 && (
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            {healthy.length} steady
          </span>
          {healthy.map((area) => (
            <Link
              key={area.id}
              to="/$areaSlug"
              params={{ areaSlug: area.slug }}
              title={area.name}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <AreaIcon icon={area.icon} className="size-3.5" />
              <span className="sr-only">{area.name}</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
