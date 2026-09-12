import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import { useAttentionClock } from "@/hooks/use-attention-clock";

/**
 * The Dashboard composes the three list queries the rest of the app already
 * subscribes to, so a Note write reruns only the Notes source, an Area
 * condition change only the Areas source — and the palette's caches are the
 * same caches.
 */
export function DashboardScreen() {
  const currentDate = useAttentionClock();
  const areas = useQuery(api.areas.list);
  const threads = useQuery(api.threads.list);
  const notes = useQuery(api.notes.list);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const loading =
    areas === undefined || threads === undefined || notes === undefined;

  return (
    <div className="mx-auto max-w-400 pb-4">
      {loading ? (
        <DashboardOverviewSkeleton />
      ) : (
        <DashboardOverview
          areas={areas}
          threads={threads}
          notes={notes}
          currentDate={currentDate}
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
