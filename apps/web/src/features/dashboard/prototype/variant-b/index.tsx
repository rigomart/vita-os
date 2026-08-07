// PROTOTYPE — throwaway. Variant B of the dashboard direction prototype (?variant=b).
//
// "Fully integrated": the area-health section is deleted outright and its
// signal woven into the Plan canvas, which is the first and default tab. Lane
// headers link to the Area page and carry a persistent condition pill, filter
// chips get condition glyphs, and the tally row carries the all-clear line.
// The Overview tab stays condition-blind — that is the tradeoff under test.
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";

import type { DashboardOverviewData } from "@/features/dashboard/components/dashboard-model";

import {
  DashboardHeader,
  OverviewTab,
} from "@/features/dashboard/components/dashboard-overview";

import { PlanCanvas } from "./plan-canvas";

export function VariantB({
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
          <OverviewTab
            overview={overview}
            areaById={areaById}
            currentDate={currentDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
