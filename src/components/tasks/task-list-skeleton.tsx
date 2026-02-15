import { Separator } from "@/components/ui/separator";

export function TaskListSkeleton() {
  return (
    <div>
      <div className="mb-4 h-8 w-20 animate-pulse rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <div key={i}>
          <div className="flex items-center gap-3 py-3">
            <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
          <Separator />
        </div>
      ))}
    </div>
  );
}
