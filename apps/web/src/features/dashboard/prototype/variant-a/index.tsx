// PROTOTYPE — throwaway. Variant A of the dashboard direction prototype (?variant=a).
//
// "Scoped tabs": Plan is the first and default tab, and the area-health section
// no longer floats above the tabs — it moves inside the Overview tab. The Plan
// canvas absorbs the two jobs area health used to do above the fold: each lane
// header links to its area page, and non-healthy lanes always show their
// condition label + icon in the lane status line.
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";

import type { DashboardOverviewData } from "@/features/dashboard/components/dashboard-model";

import { AreaConditionOverview } from "@/features/dashboard/components/area-condition-overview";
import {
  DashboardHeader,
  OverviewTab,
} from "@/features/dashboard/components/dashboard-overview";

import { PlanCanvas } from "./plan-canvas";

export function VariantA({
  overview,
  currentDate,
}: {
  overview: DashboardOverviewData;
  currentDate: number;
}) {
  const areaById = new Map(overview.areas.map((area) => [area.id, area]));

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader currentDate={currentDate} />

      <Tabs defaultValue="plan" className="gap-5">
        <TabsList aria-label="Dashboard view">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <PlanCanvas
            areas={overview.areas}
            currentDate={currentDate}
            tasks={overview.inbox.items}
            threads={overview.threads}
          />
        </TabsContent>
        <TabsContent value="overview">
          <div className="flex flex-col gap-6">
            <AreaConditionOverview areas={overview.areas} />
            <OverviewTab
              overview={overview}
              areaById={areaById}
              currentDate={currentDate}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
