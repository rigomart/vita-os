import { Separator } from "@vita-os/ui/components/separator";
import { Skeleton } from "@vita-os/ui/components/skeleton";

export function ThreadDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" data-testid="thread-detail-skeleton">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 pr-24">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-8 w-2/3" />
          <div className="flex min-h-9 items-center">
            <Skeleton className="h-7 w-28 rounded-4xl" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
        <Separator />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 py-2">
            <Skeleton className="size-6 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
