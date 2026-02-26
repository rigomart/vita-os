import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "@/components/ui/item";

interface CompletedItemRowProps {
  item: Doc<"items">;
}

export function CompletedItemRow({ item }: CompletedItemRowProps) {
  const uncompleteItem = useMutation(api.items.uncomplete).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.listCompleted, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.listCompleted,
          {},
          current.filter((i) => i._id !== args.id),
        );
      }
    },
  );

  return (
    <Item size="sm" className="hover:bg-surface-3/30">
      <ItemMedia>
        <Checkbox
          checked
          onCheckedChange={() => uncompleteItem({ id: item._id })}
          aria-label="Uncomplete item"
        />
      </ItemMedia>
      <ItemContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/60 line-through decoration-muted-foreground/30">
          {item.text}
        </p>
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          {item.date && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 px-1.5 py-0.5 text-muted-foreground/50">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(item.date), "MMM d, yyyy")}
            </span>
          )}
          <span className="text-muted-foreground/50">
            {item.completedAt
              ? `Completed ${formatDistanceToNow(new Date(item.completedAt), { addSuffix: true })}`
              : formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                })}
          </span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
