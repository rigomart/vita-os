import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import { useAttentionClock } from "@/hooks/use-attention-clock";

export function DashboardScreen() {
  const currentDate = useAttentionClock();
  // Stable for the whole day, so the query re-runs at the rollover and not on
  // every render.
  const dateContext = useMemo(
    () => ({
      currentDate,
      timezoneOffsetMinutes: new Date(currentDate).getTimezoneOffset(),
    }),
    [currentDate],
  );
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
