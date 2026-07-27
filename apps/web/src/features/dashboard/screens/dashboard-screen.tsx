import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";

export function DashboardScreen() {
  const overview = useQuery(api.dashboard.overview);
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {overview === undefined ? (
        <DashboardOverviewSkeleton />
      ) : (
        <DashboardOverview
          overview={overview}
          currentDate={Date.now()}
          onCreateArea={() => setShowCreateArea(true)}
        />
      )}

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
