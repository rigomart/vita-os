import { Skeleton } from "@vita-os/ui/components/skeleton";

/** The board's shape before its three queries land: header, columns, margin. */
export function DashboardOverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 xl:h-[calc(100svh-10rem)] xl:min-h-136"
      data-testid="dashboard-overview-skeleton"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="ml-auto h-6 w-48 rounded-md" />
      </div>

      <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1 xl:flex-row">
        <div className="grid gap-3 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, column) => (
            <div
              key={column}
              className="flex flex-col gap-2 rounded-xl border border-border/50 p-2.5 xl:min-h-0"
            >
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 3 }, (_, row) => (
                <Skeleton key={row} className="h-12 rounded-lg" />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 xl:w-68 xl:shrink-0 xl:border-l xl:border-border/60 xl:pl-4">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 3 }, (_, row) => (
            <Skeleton key={row} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
