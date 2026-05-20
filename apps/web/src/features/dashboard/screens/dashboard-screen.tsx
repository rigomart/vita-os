import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useCreateStarterArea } from "@/features/areas/area-form/use-create-area";
import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { DashboardAreasSection } from "@/features/dashboard/components/dashboard-areas-section";
import { RecentItems } from "@/features/dashboard/components/recent-items";
import { shouldShowAreaSetup } from "./dashboard-screen-state";

export function DashboardScreen() {
  const overview = useQuery(api.dashboard.overview);
  const createStarterArea = useCreateStarterArea();
  const [showCreateArea, setShowCreateArea] = useState(false);
  const areas = overview?.areas ?? [];
  const attentionThreads = overview?.attentionThreads ?? [];
  const showAreaSetup = shouldShowAreaSetup({
    areaCount: areas.length,
    attentionThreadCount: attentionThreads.length,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <h1 className="text-lg font-medium tracking-tight">Dashboard</h1>

      {showAreaSetup && (
        <DashboardAreasSection
          areas={areas}
          onCreateArea={() => setShowCreateArea(true)}
          onCreateStarterArea={createStarterArea}
        />
      )}

      <AttentionSection currentDate={Date.now()} threads={attentionThreads} />

      <RecentItems />

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
