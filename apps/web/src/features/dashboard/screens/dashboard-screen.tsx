import { api } from "@convex/_generated/api";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useCreateStarterArea } from "@/features/areas/area-form/use-create-area";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { RecentTasks } from "@/features/dashboard/components/recent-tasks";

export function DashboardScreen() {
  const overview = useQuery(api.dashboard.overview);
  const createStarterAreaMutation = useCreateStarterArea();
  const { run: createStarterArea } = useGuardedAsyncAction(
    createStarterAreaMutation,
    { successMessage: "Area created" },
  );
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <h1 className="text-lg font-medium tracking-tight">Dashboard</h1>

      <DashboardOverview
        overview={overview}
        currentDate={Date.now()}
        onCreateArea={() => setShowCreateArea(true)}
        onCreateStarterArea={createStarterArea}
      />

      <RecentTasks />

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
