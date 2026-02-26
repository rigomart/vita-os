import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarIcon, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "@/components/ui/item";

interface ItemRowProps {
  item: Doc<"items">;
  onProcess?: (item: Doc<"items">) => void;
}

export function ItemRow({ item, onProcess }: ItemRowProps) {
  const removeItem = useMutation(api.items.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          current.filter((i) => i._id !== args.id),
        );
      }

      const count = localStore.getQuery(api.items.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.items.count, {}, Math.max(0, count - 1));
      }
    },
  );

  const completeItem = useMutation(api.items.complete).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          current.filter((i) => i._id !== args.id),
        );
      }

      const count = localStore.getQuery(api.items.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.items.count, {}, Math.max(0, count - 1));
      }
    },
  );

  return (
    <Item size="sm" className="hover:bg-accent/50">
      <ItemMedia>
        <Checkbox
          checked={item.isCompleted}
          onCheckedChange={() => completeItem({ id: item._id })}
          aria-label="Complete item"
        />
      </ItemMedia>
      <ItemContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {item.text}
        </p>
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          {item.date && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-primary/80">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(item.date), "MMM d, yyyy")}
            </span>
          )}
          <span className="text-muted-foreground/60">
            {formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
            })}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions className="opacity-0 transition-opacity group-hover/item:opacity-100">
        {onProcess && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onProcess(item)}
            aria-label="Process item"
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Discard item"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard item?</AlertDialogTitle>
              <AlertDialogDescription>
                This item will be permanently deleted. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeItem({ id: item._id })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>
    </Item>
  );
}
