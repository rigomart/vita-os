import { api } from "@convex/_generated/api";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CompletedItemRow } from "@/features/items/completed-item-row/completed-item-row";
import { useUncompleteItem } from "@/features/items/use-uncomplete-item";

export function CompletedScreen() {
  const items = useQuery(api.items.listCompleted);
  const uncompleteItem = useUncompleteItem();

  if (items === undefined) {
    return <CompletedSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Completed" />
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No completed items yet
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
          {items.map((item) => (
            <CompletedItemRow
              key={item._id}
              item={item}
              onUncomplete={() => uncompleteItem(item._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompletedSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="border-b py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
