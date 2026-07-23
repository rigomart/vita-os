import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vita-os/ui/components/card";
import { Skeleton } from "@vita-os/ui/components/skeleton";

export function ThreadDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="thread-detail-skeleton">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 pr-10">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="size-8" />
        </div>
        <Skeleton className="h-8 w-2/3" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <Card size="sm">
        <CardHeader className="sr-only">
          <CardTitle>Loading Thread attention</CardTitle>
          <CardDescription>
            Loading the Next Move and Follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
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
