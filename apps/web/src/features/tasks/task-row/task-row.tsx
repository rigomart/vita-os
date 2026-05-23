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
  const [isEditingText, setIsEditingText] = useState(false);
  const [draftText, setDraftText] = useState(task.text);
  const [isWhenOpen, setIsWhenOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveCommittedRef = useRef(false);

  useEffect(() => {
    if (isEditingText) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingText]);

  useEffect(() => {
    if (!isEditingText) {
      setDraftText(task.text);
    }
  }, [isEditingText, task.text]);

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

  const saveText = () => {
    if (saveCommittedRef.current || isSavingText) {
      return;
    }

    const nextText = draftText.trim();
    setIsEditingText(false);

    if (nextText && nextText !== task.text) {
      saveCommittedRef.current = true;
      void Promise.resolve(onUpdateText(nextText)).finally(() => {
        saveCommittedRef.current = false;
      });
    } else {
      setDraftText(task.text);
    }
  };

  const cancelTextEdit = () => {
    setDraftText(task.text);
    setIsEditingText(false);
  };

  return (
    <Item size="sm" className="items-start gap-3 hover:bg-accent/50">
      <ItemMedia>
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
              disabled={isSavingText}
              aria-busy={isSavingText}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveText();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelTextEdit();
                }
              }}
              aria-label="Edit task text"
              className="h-7 min-w-0 flex-1 rounded-md px-2 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingText(true)}
              className={
                isDone
                  ? "min-w-0 flex-1 whitespace-pre-wrap text-left text-sm leading-relaxed text-muted-foreground/60 line-through decoration-muted-foreground/30 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                  : "min-w-0 flex-1 whitespace-pre-wrap text-left text-sm leading-relaxed outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/30"
              }
            >
              {task.text}
            </button>
          )}
          <ItemActions className="shrink-0 opacity-0 transition-opacity group-hover/task:opacity-100">
            {onProcess && !isDone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onProcess}
                aria-label="Process task"
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
                    aria-label="Discard task"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </AlertDialogTrigger>
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
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          <Popover open={isWhenOpen} onOpenChange={setIsWhenOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isWhenPending}
                  aria-busy={isWhenPending}
                  className={
                    whenIsEmphasized
                      ? "h-6 rounded-md border border-primary/20 bg-primary/5 px-1.5 text-primary/80 hover:bg-primary/10 hover:text-primary"
                      : taskWhen
                        ? "h-6 rounded-md border border-border-subtle bg-surface-3 px-1.5 text-muted-foreground hover:text-foreground"
                        : "h-6 rounded-md px-1.5 text-muted-foreground/55 hover:text-muted-foreground"
                  }
                />
              }
            >
              <CalendarIcon className="h-3 w-3" />
              {taskWhen ? format(taskWhen, "MMM d, yyyy") : "Add When"}
            </PopoverTrigger>
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
          <span className="text-muted-foreground/60">{timestamp}</span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
