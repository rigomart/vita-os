import { Skeleton } from "@vita-os/ui/components/skeleton";

export function ThreadDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
        <Skeleton className="mb-2 h-3 w-12" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-1 h-8 w-full" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
