import { Skeleton } from "@vita-os/ui/components/skeleton";

export function AreaThreadsSkeleton() {
  return (
    <div
      className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2"
      data-testid="area-threads-skeleton"
    >
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
      ))}
    </div>
  );
}
