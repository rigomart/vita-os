import { Skeleton } from "@vita-os/ui/components/skeleton";

export function DashboardOverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      data-testid="dashboard-overview-skeleton"
    >
      <header className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-32" />
      </header>

      <div className="grid h-17 overflow-hidden rounded-xl border md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-t-2 px-3 py-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-4 w-28" />
          </div>
        ))}
      </div>

      <Skeleton className="h-8 w-40" />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-8">
          {Array.from({ length: 3 }).map((_, section) => (
            <section key={section}>
              <Skeleton className="mb-3 h-4 w-40" />
              <div className="space-y-4">
                {Array.from({ length: section === 0 ? 3 : 2 }).map((_, row) => (
                  <div key={row}>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-1.5 h-3 w-72 max-w-full" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
        <aside className="space-y-5 xl:border-l xl:border-border/50 xl:pl-6">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 3 }).map((_, row) => (
            <Skeleton key={row} className="h-4 w-full" />
          ))}
        </aside>
      </div>
    </div>
  );
}
