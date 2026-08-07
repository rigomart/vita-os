import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { CalendarRange, ChevronRight, MessagesSquare } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  getScheduleSlots,
  getScheduleTarget,
} from "@/features/dashboard/components/dashboard-model";

import type { MockArea, MockThread } from "./mock-data";

import { mockAreaById, mockThreads, NOW } from "./mock-data";

/**
 * Baseline: the Plan tab exactly as it ships today, rendered against the shared
 * mock dataset. Kept so every other prototype has something to be compared to.
 *
 * Faithful copy of `PlanningSchedule` in
 * `@/features/dashboard/components/dashboard-overview`, with the router Links
 * swapped for inert chips (the gallery route has no Thread rail to open).
 */
export function StatusQuoPlan() {
  const currentDate = NOW;
  const threads = mockThreads;
  const slots = getScheduleSlots(currentDate);
  const undated = threads.filter((thread) => thread.followUp == null);

  return (
    <section aria-labelledby="schedule-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" />
        <h2 id="schedule-heading" className="text-sm font-semibold">
          Schedule
        </h2>
      </div>

      <div className="grid border-y border-border/70 md:grid-cols-3 xl:grid-cols-6">
        {slots.map((slot, index) => {
          const matching = threads.filter(
            (thread) =>
              getScheduleTarget(thread.followUp, currentDate) === slot.key,
          );

          return (
            <div
              key={slot.key}
              className={cn(
                "min-w-0 border-t border-border/70 px-2 py-3 first:border-t-0 md:border-t-0 md:border-l",
                index === 0 && "md:border-l-0",
              )}
            >
              <h3 className="mb-2 text-xs font-semibold">{slot.label}</h3>
              <div className="flex min-h-20 flex-col items-start gap-1.5">
                {matching.map((thread) => (
                  <PlanThreadChip
                    key={thread.id}
                    thread={thread}
                    area={mockAreaById.get(thread.areaId)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
          <span>No date</span>
          <span className="tabular-nums">{undated.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-2 pt-1 pb-2">
            {undated.map((thread) => (
              <PlanThreadChip
                key={thread.id}
                thread={thread}
                area={mockAreaById.get(thread.areaId)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function PlanThreadChip({
  thread,
  area,
}: {
  thread: MockThread;
  area?: MockArea;
}) {
  if (!area) return null;

  return (
    <span className="inline-flex h-7 max-w-full items-center justify-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
      <MessagesSquare className="size-3.5 shrink-0" />
      <span className="truncate">{thread.title}</span>
      <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
    </span>
  );
}
