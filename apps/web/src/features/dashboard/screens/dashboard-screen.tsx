import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";

export function DashboardScreen() {
  const [dateContext] = useState(() => {
    const currentDate = Date.now();
    return {
      currentDate,
      timezoneOffsetMinutes: new Date(currentDate).getTimezoneOffset(),
    };
  });
  const overview = useQuery(api.dashboard.overview, dateContext);
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {overview === undefined ? (
        <DashboardOverviewSkeleton />
      ) : (
        <DashboardOverview
          overview={overview}
          currentDate={dateContext.currentDate}
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
