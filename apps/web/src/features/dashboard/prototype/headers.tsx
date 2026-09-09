/**
 * PROTOTYPE — issue #314. The header band, settled at H2: one row, Areas on
 * the left, the five counts on the right.
 *
 * Areas are drawn as *status*, not as filter chips — no pill outline, no
 * enclosing background at rest. Each Area is its icon in its condition colour,
 * its name, and how much is pending in it, with a hover wash and underline to
 * say it is clickable. Clicking opens the Quick Panel: Condition segments,
 * the Standard, and capture scoped to that Area.
 *
 * The reason text from H1 is deliberately gone: every card below already says
 * what to do, so the band only has to say *which part of life is slipping*.
 */
import type { Condition } from "@convex/lib/condition";

import { conditionLabels } from "@convex/lib/condition";
import { format } from "date-fns";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { DashboardArea } from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { PrototypeAreaPanel } from "./prototype-area-panel";
import { StatStrip } from "./stat-strip";

export interface HeaderProps {
  areas: DashboardArea[];
  currentDate: number;
  entries: PrototypeEntry[];
  onConditionChange: (areaId: string, condition: Condition) => void;
}

/** Worst condition first, then authored order. */
function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) =>
    area.condition === "critical" ? 0 : area.condition === "healthy" ? 2 : 1;
  return rank(a) - rank(b) || a.order - b.order;
}

export function DashboardHeader({
  areas,
  currentDate,
  entries,
  onConditionChange,
}: HeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/50 pb-2">
      <time
        dateTime={new Date(currentDate).toISOString()}
        className="shrink-0 text-xs text-muted-foreground"
      >
        <span className="font-semibold text-foreground">
          {format(new Date(currentDate), "EEE")}
        </span>{" "}
        · {format(new Date(currentDate), "MMM d")}
      </time>

      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {[...areas].sort(worstFirst).map((area) => {
          const pending = entries.filter(
            (entry) => entry.area?.id === area.id,
          ).length;
          const steady = area.condition === "healthy";

          return (
            <PrototypeAreaPanel
              key={area.id}
              area={area}
              onConditionChange={onConditionChange}
              trigger={
                <button
                  type="button"
                  aria-label={`Area panel for ${area.name}`}
                  title={`${area.name} — ${conditionLabels[area.condition]}`}
                  className="group -mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              }
            >
              <span
                className={cn(
                  "inline-flex shrink-0",
                  steady
                    ? "text-muted-foreground/70"
                    : conditionTextClassName[area.condition],
                )}
              >
                <AreaIcon icon={area.icon} className="size-4" />
              </span>
              <span
                className={cn(
                  "max-w-[9rem] truncate text-sm underline-offset-4 group-hover:underline",
                  steady
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {area.name}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                {pending}
              </span>
            </PrototypeAreaPanel>
          );
        })}
      </div>

      <div className="ml-auto">
        <StatStrip currentDate={currentDate} entries={entries} />
      </div>
    </div>
  );
}
