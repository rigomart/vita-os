import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Compass, Plus } from "lucide-react";
import { useState } from "react";
import { AreaCard } from "@/components/areas/area-card";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { TaskRow } from "@/components/tasks/task-row";
import { UpcomingSection } from "@/components/tasks/upcoming-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const tasks = useQuery(api.tasks.list);
  const upcomingTasks = useQuery(api.tasks.listUpcoming, {});
  const projects = useQuery(api.projects.list);
  const areas = useQuery(api.areas.list);
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
  const [showCreateArea, setShowCreateArea] = useState(false);
  const isLoading = tasks === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl">
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

      <UpcomingSection tasks={upcomingTasks ?? []} />

      <InboxSummary tasks={tasks} />

      <AreaFormDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
        onSubmit={(data) => createArea(data)}
      />
    </div>
  );
}

const INBOX_PREVIEW_LIMIT = 5;

function InboxSummary({ tasks }: { tasks: Doc<"tasks">[] }) {
  const activeTasks = tasks.filter((t) => !t.isCompleted);
  const preview = activeTasks.slice(0, INBOX_PREVIEW_LIMIT);
  const overflow = activeTasks.length - preview.length;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Inbox</h2>
        <Link
          to="/inbox"
          className="text-xs text-muted-foreground hover:underline"
        >
          View all ({activeTasks.length})
        </Link>
      </div>
      {activeTasks.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No inbox tasks.
        </p>
      ) : (
        <div>
          {preview.map((task) => (
            <TaskRow key={task._id} task={task} />
          ))}
          {overflow > 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              +{overflow} more in{" "}
              <Link to="/inbox" className="hover:underline">
                Inbox
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl">
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

      <div className="mb-6">
        <Skeleton className="mb-3 h-4 w-20" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
              key={i}
              className="flex items-start gap-3 py-3"
            >
              <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
        <TaskListSkeleton />
      </div>
    </div>
  );
}
