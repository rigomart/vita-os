import type { Doc } from "@convex/_generated/dataModel";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { ChevronRight, Inbox } from "lucide-react";

import { TaskRow } from "@/features/tasks/task-row/task-row";
import { useTaskRowActions } from "@/features/tasks/task-row/use-task-row-actions";
import { flatListClassName } from "@/lib/flat-surface";

interface InboxTaskListProps {
  tasks: Doc<"tasks">[];
  onProcess?: (task: Doc<"tasks">) => void;
}

export function InboxTaskList({ tasks, onProcess }: InboxTaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Inbox zero — nothing to process
        </p>
      </div>
    );
  }

  const openTasks = tasks.filter((task) => task.state === "open");
  const doneTasks = tasks.filter((task) => task.state === "done");

  return (
    <div className="space-y-1">
      {openTasks.length > 0 && (
        <div className={flatListClassName}>
          {openTasks.map((task) => (
            <InboxTaskRow key={task._id} task={task} onProcess={onProcess} />
          ))}
        </div>
      )}

      {doneTasks.length > 0 && (
        <Collapsible className={openTasks.length > 0 ? "pt-3" : undefined}>
          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
            <span>Done</span>
            <span className="ml-auto text-xs tabular-nums">
              {doneTasks.length}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={flatListClassName}>
              {doneTasks.map((task) => (
                <InboxTaskRow key={task._id} task={task} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function InboxTaskRow({
  task,
  onProcess,
}: {
  task: Doc<"tasks">;
  onProcess?: (task: Doc<"tasks">) => void;
}) {
  const {
    handleToggleComplete,
    isTogglePending,
    handleRemove,
    isDiscardPending,
    handleUpdateText,
    isSavingText,
    handleUpdateWhen,
    isWhenPending,
  } = useTaskRowActions(task);

  return (
    <TaskRow
      task={task}
      onToggleComplete={handleToggleComplete}
      onRemove={handleRemove}
      onUpdateText={handleUpdateText}
      onUpdateWhen={handleUpdateWhen}
      onProcess={onProcess ? () => onProcess(task) : undefined}
      isTogglePending={isTogglePending}
      isDiscardPending={isDiscardPending}
      isSavingText={isSavingText}
      isWhenPending={isWhenPending}
    />
  );
}
