import type { Doc } from "@convex/_generated/dataModel";
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
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { Checkbox } from "@vita-os/ui/components/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "@vita-os/ui/components/item";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarIcon, Trash2 } from "lucide-react";

interface ItemRowProps {
  item: Doc<"items">;
  onToggleComplete: () => void;
  onRemove: () => void;
  onProcess?: () => void;
}

export function ItemRow({
  item,
  onToggleComplete,
  onRemove,
  onProcess,
}: ItemRowProps) {
  const timestamp = item.isCompleted
    ? `Completed ${formatDistanceToNow(
        new Date(item.completedAt ?? item.createdAt),
        {
          addSuffix: true,
        },
      )}`
    : formatDistanceToNow(new Date(item.createdAt), {
        addSuffix: true,
      });

  return (
    <Item size="sm" className="items-start gap-3 hover:bg-accent/50">
      <ItemMedia>
        <Checkbox
          checked={item.isCompleted}
          onCheckedChange={onToggleComplete}
          aria-label={item.isCompleted ? "Uncomplete item" : "Complete item"}
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1.5">
        <div className="flex min-w-0 items-start gap-2">
          <p
            className={
              item.isCompleted
                ? "min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/60 line-through decoration-muted-foreground/30"
                : "min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed"
            }
          >
            {item.text}
          </p>
          <ItemActions className="shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100">
            {onProcess && !item.isCompleted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onProcess}
                aria-label="Process item"
              >
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Discard item"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
                    onClick={onRemove}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </ItemActions>
        </div>
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          {item.date && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-primary/80">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(item.date), "MMM d, yyyy")}
            </span>
          )}
          <span className="text-muted-foreground/60">{timestamp}</span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
