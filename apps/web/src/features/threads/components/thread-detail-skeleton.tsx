import { Skeleton } from "@vita-os/ui/components/skeleton";

export function ThreadDetailSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-testid="thread-detail-skeleton"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 pr-24">
          <Skeleton className="size-1.5 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-4xl" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-2">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-px flex-1" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 py-2">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-10 w-full rounded-3xl" />
    </div>
  );
}
