import { Skeleton } from "@vita-os/ui/components/skeleton";

import { flatListClassName } from "@/lib/flat-surface";

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-10" data-testid="dashboard-overview-skeleton">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className={flatListClassName}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className={flatListClassName}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
