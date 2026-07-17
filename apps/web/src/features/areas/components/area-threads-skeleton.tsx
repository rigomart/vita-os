import { Skeleton } from "@vita-os/ui/components/skeleton";

import { flatListClassName } from "@/lib/flat-surface";

export function AreaThreadsSkeleton() {
  return (
    <div className={flatListClassName} data-testid="area-threads-skeleton">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
      ))}
    </div>
  );
}
