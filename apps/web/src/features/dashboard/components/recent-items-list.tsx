import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import {
  Item,
  ItemContent,
  ItemDescription,
} from "@vita-os/ui/components/item";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Inbox } from "lucide-react";

const MAX_VISIBLE = 5;

interface RecentItemsListProps {
  items: Doc<"items">[];
}

export function RecentItemsList({ items }: RecentItemsListProps) {
  const activeItems = items.filter((item) => !item.isCompleted);
  const visibleItems = activeItems.slice(0, MAX_VISIBLE);

  if (activeItems.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">Recent Tasks</h2>
        <span className="text-xs text-muted-foreground">
          {activeItems.length}
        </span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {visibleItems.map((item) => (
          <RecentItemRow key={item._id} item={item} />
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Link
          to="/inbox"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View all tasks
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

function RecentItemRow({ item }: { item: Doc<"items"> }) {
  const timestamp = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
  });
  const itemDate = item.date === undefined ? undefined : new Date(item.date);

  return (
    <Item size="sm" className="items-start gap-3">
      <ItemContent className="min-w-0 gap-1.5">
        <div className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed">
          {item.text}
        </div>
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          {itemDate && (
            <>
              <span>{format(itemDate, "MMM d, yyyy")}</span>
              <span className="text-muted-foreground/40">/</span>
            </>
          )}
          <span className="text-muted-foreground/60">{timestamp}</span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
