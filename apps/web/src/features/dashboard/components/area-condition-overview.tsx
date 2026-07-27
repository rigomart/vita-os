import { type Condition } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import { type DashboardArea } from "./dashboard-model";

const conditionOrder: Condition[] = ["critical", "needs_attention", "healthy"];

const conditionLabels: Record<Condition, string> = {
  critical: "Critical",
  needs_attention: "Needs attention",
  healthy: "Steady",
};

const conditionShortLabels: Record<Condition, string> = {
  critical: "Needs you",
  needs_attention: "Watch",
  healthy: "Steady",
};

const conditionText: Record<Condition, string> = {
  critical: "text-condition-critical",
  needs_attention: "text-condition-attention",
  healthy: "text-condition-healthy",
};

export function AreaConditionOverview({ areas }: { areas: DashboardArea[] }) {
  return (
    <section
      aria-label="Life Areas by condition"
      className="flex flex-col gap-2"
    >
      <div className="grid h-1.5 grid-cols-3 gap-1 overflow-hidden rounded-full">
        <span className="bg-condition-critical" />
        <span className="bg-condition-attention" />
        <span className="bg-condition-healthy" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 md:gap-6">
        {conditionOrder.map((condition) => {
          const matchingAreas = areas.filter(
            (area) => area.condition === condition,
          );

          return (
            <div
              key={condition}
              role="group"
              aria-label={`${conditionLabels[condition]} Life Areas`}
              className="flex min-w-0 items-start gap-3"
            >
              <span
                className={cn(
                  "pt-0.5 text-lg font-semibold leading-none tabular-nums",
                  conditionText[condition],
                )}
              >
                {matchingAreas.length}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {conditionShortLabels[condition]}
                </span>
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                  {matchingAreas.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : (
                    matchingAreas.map((area) => (
                      <Link
                        key={area.id}
                        to="/$areaSlug"
                        params={{ areaSlug: area.slug }}
                        className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-medium hover:text-primary"
                      >
                        <AreaIcon
                          icon={area.icon}
                          className="size-3.5 shrink-0"
                        />
                        <span className="truncate">{area.name}</span>
                        <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
