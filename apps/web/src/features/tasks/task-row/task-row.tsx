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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
} from "@vita-os/ui/components/item";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarIcon, Trash2 } from "lucide-react";
import { useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { isTaskWhenEmphasized } from "@/features/tasks/inbox";

interface TaskRowProps {
  task: Doc<"tasks">;
  onToggleComplete: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onUpdateText: (text: string) => void | Promise<void>;
  onUpdateWhen: (when: number | undefined) => void | Promise<void>;
  onProcess?: () => void;
  isTogglePending?: boolean;
  isDiscardPending?: boolean;
  isSavingText?: boolean;
  isWhenPending?: boolean;
}

export function TaskRow({
  task,
  onToggleComplete,
  onRemove,
  onUpdateText,
  onUpdateWhen,
  onProcess,
  isTogglePending = false,
  isDiscardPending = false,
  isSavingText = false,
  isWhenPending = false,
}: TaskRowProps) {
  const [isWhenOpen, setIsWhenOpen] = useState(false);

  const now = Date.now();
  const isDone = task.state === "done";
  const timestamp = isDone
    ? `Done ${formatDistanceToNow(
        new Date(task.completedAt ?? task.createdAt),
        {
          addSuffix: true,
        },
      )}`
    : formatDistanceToNow(new Date(task.createdAt), {
        addSuffix: true,
      });
  const taskWhen = task.when === undefined ? undefined : new Date(task.when);
  const whenIsEmphasized = isTaskWhenEmphasized(task, now);
  const showWhenControl =
    taskWhen !== undefined || whenIsEmphasized || isWhenOpen;

  return (
    <Item
      size="sm"
      className="flex-nowrap items-start gap-3 rounded-md border-0 hover:bg-muted"
    >
      <ItemMedia variant="icon">
        <Checkbox
          checked={isDone}
          onCheckedChange={() => {
            if (!isTogglePending) {
              void onToggleComplete();
            }
          }}
          disabled={isTogglePending}
          aria-busy={isTogglePending}
          aria-label={isDone ? "Mark task open" : "Mark task done"}
          className="border-border/80 bg-surface-1"
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <EditableField
            value={task.text}
            onSave={(text) => {
              if (!text || isSavingText) {
                return;
              }
              void onUpdateText(text);
            }}
            disabled={isSavingText}
            inputAriaLabel="Edit task text"
            className={cn(
              "min-h-0 flex-1 py-0.5 text-sm font-medium leading-snug whitespace-pre-wrap",
              isDone &&
                "text-muted-foreground/60 line-through decoration-muted-foreground/30",
            )}
          />
          <span className="shrink-0 pt-1 text-xs tabular-nums text-muted-foreground/50">
            {timestamp}
          </span>
        </div>

        <div className="flex min-h-6 w-full items-center gap-2 text-xs text-muted-foreground">
          <Popover open={isWhenOpen} onOpenChange={setIsWhenOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isWhenPending}
                  aria-busy={isWhenPending}
                  className={cn(
                    "h-6 gap-1 rounded-md px-1.5 transition-opacity",
                    whenIsEmphasized
                      ? "border border-primary/20 bg-primary/5 text-primary/80 hover:bg-primary/10 hover:text-primary"
                      : taskWhen
                        ? "border border-border-subtle bg-surface-3 text-muted-foreground hover:text-foreground"
                        : "text-muted-foreground hover:text-muted-foreground",
                    !showWhenControl &&
                      "pointer-events-none opacity-0 group-hover/item:pointer-events-auto group-hover/item:opacity-100 group-focus-within/item:pointer-events-auto group-focus-within/item:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
                  )}
                >
                  <CalendarIcon className="h-3 w-3 shrink-0" />
                  {taskWhen ? format(taskWhen, "MMM d, yyyy") : "Add When"}
                </Button>
              }
            />
            <PopoverContent className="w-auto gap-0 p-0" align="start">
              <Calendar
                mode="single"
                selected={taskWhen}
                disabled={isWhenPending}
                onSelect={(date) => {
                  if (!date || isWhenPending) return;
                  void onUpdateWhen(date.getTime());
                  setIsWhenOpen(false);
                }}
              />
              {taskWhen && (
                <div className="border-t border-border/60 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    disabled={isWhenPending}
                    aria-busy={isWhenPending}
                    onClick={() => {
                      if (isWhenPending) return;
                      void onUpdateWhen(undefined);
                      setIsWhenOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <ItemActions className="ml-auto shrink-0 gap-1 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100">
            {onProcess && !isDone && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onProcess}
                aria-label="Process task"
              >
                <ArrowRight className="size-4 text-muted-foreground" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Discard task"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This task will be permanently removed from your Inbox. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (!isDiscardPending) {
                        void onRemove();
                      }
                    }}
                    disabled={isDiscardPending}
                    aria-busy={isDiscardPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </ItemActions>
        </div>
      </ItemContent>
    </Item>
  );
}
