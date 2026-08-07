import { Skeleton } from "@vita-os/ui/components/skeleton";

export function DashboardOverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      data-testid="dashboard-overview-skeleton"
    >
      <header className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-32" />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-44 rounded-full" />
      </div>

      <Skeleton className="h-[26rem] w-full rounded-xl" />
    </div>
  );
}
