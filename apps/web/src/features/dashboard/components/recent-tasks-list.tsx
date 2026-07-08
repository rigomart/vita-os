import type { Doc } from "@convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import {
  Item,
  ItemContent,
  ItemDescription,
} from "@vita-os/ui/components/item";
import { cn } from "@vita-os/ui/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Check, Inbox } from "lucide-react";

import { isTaskWhenDue } from "@/features/tasks/inbox";
import {
  flatListClassName,
  flatListRowHoverClassName,
} from "@/lib/flat-surface";

import { RecentTasksSkeleton } from "./recent-tasks-skeleton";

const MAX_VISIBLE = 5;

interface RecentTasksListProps {
  tasks: Doc<"tasks">[];
  isLoading?: boolean;
  referenceDate?: number;
}

export function RecentTasksList({
  tasks,
  isLoading = false,
  referenceDate = Date.now(),
}: RecentTasksListProps) {
  if (isLoading) {
    return <RecentTasksSkeleton />;
  }

  const activeTasks = tasks.filter((task) => task.state === "open");
  const dueTasks = activeTasks.filter((task) =>
    isTaskWhenDue(task.when, referenceDate),
  );
  const visibleTasks = dueTasks.slice(0, MAX_VISIBLE);
  const remainingOpenCount = activeTasks.length - visibleTasks.length;
  const hasDueTasks = dueTasks.length > 0;
  const heading = hasDueTasks ? "Due Tasks" : "Inbox";
  const headingCount =
    dueTasks.length > 0 ? dueTasks.length : activeTasks.length;

  if (activeTasks.length === 0) {
    return (
      <section className="flex items-center gap-2 text-muted-foreground">
        <Check className="h-3.5 w-3.5 shrink-0 text-condition-healthy" />
        <p className="text-sm">Inbox is clear</p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">{heading}</h2>
        <span className="text-xs text-muted-foreground">{headingCount}</span>
      </div>
      {hasDueTasks && (
        <div className={flatListClassName}>
          {visibleTasks.map((task) => (
            <RecentTaskRow key={task._id} task={task} />
          ))}
        </div>
      )}
      {hasDueTasks && remainingOpenCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {remainingOpenCount} more Open{" "}
          {remainingOpenCount === 1 ? "Task" : "Tasks"} in Inbox
        </p>
      )}
      {!hasDueTasks && (
        <p className="text-xs text-muted-foreground">
          {activeTasks.length} Open{" "}
          {activeTasks.length === 1 ? "Task" : "Tasks"} in Inbox
        </p>
      )}
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

function RecentTaskRow({ task }: { task: Doc<"tasks"> }) {
  const timestamp = formatDistanceToNow(new Date(task.createdAt), {
    addSuffix: true,
  });
  const taskWhen = task.when === undefined ? undefined : new Date(task.when);

  return (
    <Item
      size="sm"
      className={cn(
        "flex-nowrap items-start gap-3 rounded-none border-0",
        flatListRowHoverClassName,
      )}
    >
      <ItemContent className="min-w-0 gap-1.5">
        <div className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed">
          {task.text}
        </div>
        <ItemDescription className="flex items-center gap-2 text-[11px]">
          {taskWhen && (
            <>
              <span>{format(taskWhen, "MMM d, yyyy")}</span>
              <span className="text-muted-foreground/40">/</span>
            </>
          )}
          <span className="text-muted-foreground/60">{timestamp}</span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
