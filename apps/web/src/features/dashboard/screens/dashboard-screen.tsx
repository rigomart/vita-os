import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { RecentTasks } from "@/features/dashboard/components/recent-tasks";

export function DashboardScreen() {
  const overview = useQuery(api.dashboard.overview);
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Dashboard" />

      <div className="flex flex-col gap-10">
        <DashboardOverview
          overview={overview}
          currentDate={Date.now()}
          onCreateArea={() => setShowCreateArea(true)}
        />

        <RecentTasks />
      </div>

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </div>
  );
}
