import { useState } from "react";

import { CreateAreaDialog } from "../../areas/area-form/create-area-dialog";
import { useAreas } from "../../areas/hooks";
import { useAttentionClock } from "../../hooks/use-attention-clock";
import { useOpenNotes } from "../../notes/hooks";
import { useOpenThreads } from "../../threads/hooks";
import { DashboardOverview } from "../components/dashboard-overview";
import { DashboardOverviewSkeleton } from "../components/dashboard-overview-skeleton";

/**
 * The Dashboard composes the three inventories the rest of the app already
 * reads, so a Note write refreshes only the Notes source and an Area Condition
 * change only the Areas source — and the palette reads the same three.
 */
export function DashboardScreen() {
  const currentDate = useAttentionClock();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
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
