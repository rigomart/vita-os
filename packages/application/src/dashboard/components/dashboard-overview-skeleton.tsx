import { Skeleton } from "@vita-os/ui/components/skeleton";

/**
 * The Dashboard's shape before its three queries land: the filter pill, a few
 * day tabs, and from `lg` No date beside them.
 */
export function DashboardOverviewSkeleton() {
  return (
    <div
      className="mx-auto grid max-w-[76rem] gap-x-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      data-testid="dashboard-overview-skeleton"
    >
      <div className="min-w-0">
        <div className="pt-5 pb-3">
          <Skeleton className="h-10 w-full max-w-xl rounded-full" />
        </div>
        <div className="flex flex-col gap-4 pt-2">
          {[2, 1, 1].map((rows, tab) => (
            <div key={tab}>
              <Skeleton className="h-8 w-28 rounded-b-none rounded-t-xl" />
              <div className="flex flex-col gap-2 rounded-2xl rounded-tl-none bg-muted/40 p-3">
                {Array.from({ length: rows }, (_, row) => (
                  <Skeleton key={row} className="h-14 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden flex-col gap-3 border-l pt-6 pl-8 lg:flex">
        <Skeleton className="h-6 w-24" />
        {Array.from({ length: 3 }, (_, row) => (
          <Skeleton key={row} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
