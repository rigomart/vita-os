import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox } from "lucide-react";
import { ItemRowContainer } from "@/features/items/item-row/item-row-container";

interface RecentItemsListProps {
  items: Doc<"items">[];
  hasMore: boolean;
  totalCount: number;
  onProcess: (item: Doc<"items">) => void;
}

export function RecentItemsList({
  items,
  hasMore,
  totalCount,
  onProcess,
}: RecentItemsListProps) {
  if (totalCount === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">Recent Items</h2>
        <span className="text-xs text-muted-foreground">{totalCount}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {items.map((item) => (
          <ItemRowContainer key={item._id} item={item} onProcess={onProcess} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-3 flex justify-end">
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all items
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  );
}
