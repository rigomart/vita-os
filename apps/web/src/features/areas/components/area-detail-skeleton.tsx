import { Skeleton } from "@vita-os/ui/components/skeleton";

import { flatListClassName } from "@/lib/flat-surface";

export function AreaDetailSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-6"
      data-testid="area-detail-skeleton"
    >
      <div>
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-7 w-40" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className={flatListClassName}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
