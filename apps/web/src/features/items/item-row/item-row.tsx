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
import { Calendar } from "@vita-os/ui/components/calendar";
import { Checkbox } from "@vita-os/ui/components/checkbox";
import { Input } from "@vita-os/ui/components/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "@vita-os/ui/components/item";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarIcon, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ItemRowProps {
  item: Doc<"items">;
  onToggleComplete: () => void;
  onRemove: () => void;
  onUpdateText: (text: string) => void;
  onUpdateDate: (date: number | undefined) => void;
  onProcess?: () => void;
}

export function ItemRow({
  item,
  onToggleComplete,
  onRemove,
  onUpdateText,
  onUpdateDate,
  onProcess,
}: ItemRowProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(item.text);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingText) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingText]);

  useEffect(() => {
    if (!isEditingText) {
      setDraftText(item.text);
    }
  }, [isEditingText, item.text]);

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
  const itemDate = item.date === undefined ? undefined : new Date(item.date);

  const saveText = () => {
    const nextText = draftText.trim();
    setIsEditingText(false);

    if (nextText && nextText !== item.text) {
      onUpdateText(nextText);
    } else {
      setDraftText(item.text);
    }
  };

  const cancelTextEdit = () => {
    setDraftText(item.text);
    setIsEditingText(false);
  };

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
          {isEditingText ? (
            <Input
              ref={inputRef}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onBlur={saveText}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveText();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelTextEdit();
                }
              }}
              aria-label="Edit item text"
              className="h-7 min-w-0 flex-1 rounded-md px-2 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingText(true)}
              className={
                item.isCompleted
                  ? "min-w-0 flex-1 whitespace-pre-wrap text-left text-sm leading-relaxed text-muted-foreground/60 line-through decoration-muted-foreground/30 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                  : "min-w-0 flex-1 whitespace-pre-wrap text-left text-sm leading-relaxed outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/30"
              }
            >
              {item.text}
            </button>
          )}
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
          <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className={
                    itemDate
                      ? "h-6 rounded-md border border-primary/20 bg-primary/5 px-1.5 text-primary/80 hover:bg-primary/10 hover:text-primary"
                      : "h-6 rounded-md px-1.5 text-muted-foreground/55 hover:text-muted-foreground"
                  }
                />
              }
            >
              <CalendarIcon className="h-3 w-3" />
              {itemDate ? format(itemDate, "MMM d, yyyy") : "Add date"}
            </PopoverTrigger>
            <PopoverContent className="w-auto gap-0 p-0" align="start">
              <Calendar
                mode="single"
                selected={itemDate}
                onSelect={(date) => {
                  if (!date) return;
                  onUpdateDate(date.getTime());
                  setIsDateOpen(false);
                }}
              />
              {itemDate && (
                <div className="border-t border-border/60 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => {
                      onUpdateDate(undefined);
                      setIsDateOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground/60">{timestamp}</span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
