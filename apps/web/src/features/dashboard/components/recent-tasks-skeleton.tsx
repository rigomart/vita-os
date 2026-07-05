import { Skeleton } from "@vita-os/ui/components/skeleton";

import { flatListClassName } from "@/lib/flat-surface";

export function RecentTasksSkeleton() {
  return (
    <section data-testid="recent-tasks-skeleton">
      <div className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className={flatListClassName}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
