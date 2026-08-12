import { api } from "@convex/_generated/api";
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
import { usePlanActions } from "@/features/dashboard/plan/use-plan-actions";
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
  const planActions = usePlanActions({
    areas: areaDocs ?? [],
    threads: threadDocs ?? [],
  });
  const [showCreateArea, setShowCreateArea] = useState(false);

  // Explicit memos: the Plan surfaces memo on these arrays by reference.
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
          planActions={planActions}
        />
      )}

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
