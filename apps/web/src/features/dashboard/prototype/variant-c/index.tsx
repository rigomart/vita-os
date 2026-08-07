// PROTOTYPE — throwaway. Variant C of the dashboard direction prototype (?variant=c).
//
// "Plan-first single surface": no tabs — the Plan canvas IS the dashboard.
// Condition collapses from the card grid into one dense strip under the
// header; Overview's unique content (Inbox preview, Recent activity) is
// demoted to a slim secondary rail; the attention-ordered thread list is
// intentionally dropped as redundant with the lanes.
import { Separator } from "@vita-os/ui/components/separator";

import type { DashboardOverviewData } from "@/features/dashboard/components/dashboard-model";

import { DashboardHeader } from "@/features/dashboard/components/dashboard-overview";

import { ConditionStrip } from "./condition-strip";
import { PlanCanvas } from "./plan-canvas";
import { InboxSection, RecentActivity } from "./rail";

export function VariantC({
  overview,
  currentDate,
}: {
  overview: DashboardOverviewData;
  currentDate: number;
}) {
  const areaById = new Map(overview.areas.map((area) => [area.id, area]));
  const threadById = new Map(
    overview.threads.map((thread) => [thread.id, thread]),
  );

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeader currentDate={currentDate} />
      <ConditionStrip areas={overview.areas} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          <PlanCanvas
            areas={overview.areas}
            currentDate={currentDate}
            tasks={overview.inbox.items}
            threads={overview.threads}
          />
        </main>

        <aside className="flex flex-col gap-6 xl:border-l xl:border-border/50 xl:pl-6">
          <InboxSection
            items={overview.inbox.items}
            totalOpen={overview.inbox.totalOpen}
            currentDate={currentDate}
          />
          {overview.recentActivity.length > 0 && (
            <>
              <Separator />
              <RecentActivity
                entries={overview.recentActivity}
                areaById={areaById}
                threadById={threadById}
                currentDate={currentDate}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
