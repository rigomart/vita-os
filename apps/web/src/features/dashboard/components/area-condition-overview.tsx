import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { DashboardArea } from "./dashboard-model";

const attentionLabels: Partial<Record<Condition, string>> = {
  critical: "Needs you",
  needs_attention: "Watch",
};

const blockToneClassName: Partial<Record<Condition, string>> = {
  critical: "bg-condition-critical text-white",
  needs_attention: "bg-condition-attention/15 text-condition-attention",
};

const labelToneClassName: Partial<Record<Condition, string>> = {
  critical: "text-condition-critical",
  needs_attention: "text-condition-attention",
};

function byOrder(a: DashboardArea, b: DashboardArea) {
  return a.order - b.order;
}

export function AreaConditionOverview({ areas }: { areas: DashboardArea[] }) {
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
    <section
      aria-label="Life Areas by condition"
      className="flex flex-col gap-4"
    >
      {areas.length === 0 && (
        <p className="text-sm text-muted-foreground">No Life Areas yet.</p>
      )}

      {prominent.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {prominent.map((area) => (
            <Link
              key={area.id}
              to="/$areaSlug"
              params={{ areaSlug: area.slug }}
              className="flex items-center gap-3.5 rounded-xl bg-muted/40 py-3 pr-4 pl-3 transition-colors hover:bg-muted/70"
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg",
                  blockToneClassName[area.condition],
                )}
              >
                <AreaIcon icon={area.icon} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold">
                  {area.name}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    labelToneClassName[area.condition],
                  )}
                >
                  {attentionLabels[area.condition]}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {healthy.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {prominent.length === 0 && (
            <span className="text-sm text-muted-foreground">
              All areas steady.
            </span>
          )}
          {healthy.map((area) => (
            <Link
              key={area.id}
              to="/$areaSlug"
              params={{ areaSlug: area.slug }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <AreaIcon icon={area.icon} className="size-3.5" />
              {area.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
