import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
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
  const navigate = useNavigate();
  /**
   * The Area a Quick Panel asked to capture into. The dialog lives up here
   * rather than in the panel: the panel closes on the way to it, and the Areas
   * the picker needs are already on this screen.
   */
  const [newThreadAreaId, setNewThreadAreaId] = useState<string | null>(null);

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
          onNewThreadInArea={setNewThreadAreaId}
        />
      )}

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />

      {newThreadAreaId != null && areas !== undefined && (
        <CreateThreadDialog
          open
          onOpenChange={(open) => {
            if (!open) setNewThreadAreaId(null);
          }}
          areas={areas}
          defaultAreaId={newThreadAreaId as Id<"areas">}
          onCreated={({ slug }) => {
            setNewThreadAreaId(null);
            navigate({
              to: ".",
              search: (prev) => ({ ...prev, thread: slug }),
            });
          }}
        />
      )}
    </div>
  );
}
