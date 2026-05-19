import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useCreateStarterArea } from "@/features/areas/area-form/use-create-area";
import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { DashboardAreasSection } from "@/features/dashboard/components/dashboard-areas-section";
import { RecentItems } from "@/features/dashboard/components/recent-items";

export function DashboardScreen() {
  const overview = useQuery(api.dashboard.overview);
  const createStarterArea = useCreateStarterArea();
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <h1 className="text-lg font-medium tracking-tight">Dashboard</h1>

      <DashboardAreasSection
        areas={overview?.areas ?? []}
        onCreateArea={() => setShowCreateArea(true)}
        onCreateStarterArea={createStarterArea}
      />

      <AttentionSection items={overview?.attentionItems ?? []} />

      <RecentItems />

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
