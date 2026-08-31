import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import {
  toDashboardArea,
  toDashboardTask,
  toDashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardOverviewSkeleton } from "@/features/dashboard/components/dashboard-overview-skeleton";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
import { useAttentionClock } from "@/hooks/use-attention-clock";

/**
 * The Dashboard composes the three list queries the rest of the app already
 * subscribes to, so a Task write reruns only the Tasks source, an Area
 * condition change only the Areas source — and the palette's caches are the
 * same caches.
 */
export function DashboardScreen() {
  const currentDate = useAttentionClock();
  const areaDocs = useQuery(api.areas.list);
  const threadDocs = useQuery(api.threads.list);
  const taskDocs = useQuery(api.tasks.list);
  const [showCreateArea, setShowCreateArea] = useState(false);
  const navigate = useNavigate();
  /**
   * The Area a lane header's Quick Panel asked to capture into. The dialog
   * lives up here rather than in the panel: the panel closes on the way to it,
   * and the Areas the picker needs are already on this screen.
   */
  const [newThreadAreaId, setNewThreadAreaId] = useState<string | null>(null);

  // Keep the three projections stable while their source query is unchanged.
  const areas = useMemo(
    () => (areaDocs ?? []).map(toDashboardArea),
    [areaDocs],
  );
  const threads = useMemo(
    () => (threadDocs ?? []).map(toDashboardThread),
    [threadDocs],
  );
  const tasks = useMemo(
    () => (taskDocs ?? []).map(toDashboardTask),
    [taskDocs],
  );

  const loading =
    areaDocs === undefined ||
    threadDocs === undefined ||
    taskDocs === undefined;

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {loading ? (
        <DashboardOverviewSkeleton />
      ) : (
        <DashboardOverview
          areas={areas}
          threads={threads}
          tasks={tasks}
          currentDate={currentDate}
          onCreateArea={() => setShowCreateArea(true)}
          onNewThreadInArea={setNewThreadAreaId}
        />
      )}

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />

      {newThreadAreaId != null && areaDocs !== undefined && (
        <CreateThreadDialog
          open
          onOpenChange={(open) => {
            if (!open) setNewThreadAreaId(null);
          }}
          areas={areaDocs}
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
