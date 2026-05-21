import { Skeleton } from "@vita-os/ui/components/skeleton";

export function AreaDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
        <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
