import { Skeleton } from "@vita-os/ui/components/skeleton";

export function DashboardOverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      data-testid="dashboard-overview-skeleton"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="ml-auto h-6 w-20 rounded-md" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex h-10 items-center gap-3 px-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="hidden h-3 w-24 sm:block" />
          </div>
        ))}
      </div>

      <div className="border-t border-border/50 pt-3">
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
