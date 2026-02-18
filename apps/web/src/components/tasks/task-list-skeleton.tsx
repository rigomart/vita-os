import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <div key={i}>
          <div className="flex items-start gap-3 py-3">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <Separator />
        </div>
      ))}
      <div className="flex items-center gap-3 py-3">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Separator />
    </div>
  );
}
