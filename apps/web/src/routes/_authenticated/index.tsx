import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Compass, Plus } from "lucide-react";
import { useState } from "react";
import { AreaCard } from "@/components/areas/area-card";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { AttentionSection } from "@/components/dashboard/attention-section";
import { RecentCaptures } from "@/components/dashboard/recent-captures";
import { ReviewStatus } from "@/components/dashboard/review-status";
import { RouteErrorFallback } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  const lastReviewDate = useQuery(api.dashboard.lastReview);
  const createArea = useMutation(api.areas.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.areas.list, {});
      if (current !== undefined) {
        const maxOrder = current.reduce((max, a) => Math.max(max, a.order), -1);
        localStore.setQuery(api.areas.list, {}, [
          ...current,
          {
            _id: crypto.randomUUID() as Id<"areas">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            standard: args.standard,
            healthStatus: args.healthStatus,
            order: maxOrder + 1,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );
  const markReviewed = useMutation(api.dashboard.markReviewed);
  const [showCreateArea, setShowCreateArea] = useState(false);
  const isLoading = areas === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <ReviewStatus
        lastReviewDate={lastReviewDate ?? null}
        onMarkReviewed={() => markReviewed()}
      />

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Areas</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowCreateArea(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New area
          </Button>
        </div>
        {areas && areas.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => {
              const projectCount = (projects ?? []).filter(
                (p) => p.areaId === area._id,
              ).length;
              return (
                <AreaCard
                  key={area._id}
                  area={area}
                  projectCount={projectCount}
                  attentionCount={attention?.byArea[area._id] ?? 0}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <Compass className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-3 text-sm text-muted-foreground">
              Define your life areas to organize projects by responsibility.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateArea(true)}
            >
              Create area
            </Button>
          </div>
        )}
      </div>

      {attention && attention.items.length > 0 && (
        <AttentionSection items={attention.items} areas={areas ?? []} />
      )}

      <RecentCaptures />

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
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
              key={i}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
