import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AreaFormDialog } from "@/features/areas/components/area-form-dialog";
import { optimisticallyCreateArea } from "@/features/areas/optimistic";
import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { DashboardAreasSection } from "@/features/dashboard/components/dashboard-areas-section";
import { RecentItems } from "@/features/dashboard/components/recent-items";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: Dashboard,
});

function Dashboard() {
  const projects = useQuery(api.projects.list);
  const areas = useQuery(api.areas.list);
  const attention = useQuery(api.dashboard.attention);
  const createArea = useMutation(api.areas.create).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyCreateArea(localStore, args);
    },
  );
  const [showCreateArea, setShowCreateArea] = useState(false);
  const isLoading = areas === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <h1 className="text-lg font-medium tracking-tight">Dashboard</h1>

      <DashboardAreasSection
        areas={areas}
        projects={projects}
        attentionByArea={attention?.byArea}
        onCreateArea={() => setShowCreateArea(true)}
      />

      {attention && attention.items.length > 0 && (
        <AttentionSection items={attention.items} areas={areas ?? []} />
      )}

      <RecentItems />

      <AreaFormDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
        onSubmit={(data) => createArea(data)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Skeleton className="h-6 w-28" />

      <div>
        <Skeleton className="mb-4 h-4 w-12" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
              key={i}
              className="rounded-xl border border-border-subtle bg-surface-2 p-5"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
