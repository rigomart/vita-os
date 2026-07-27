import type { Doc } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isBefore, isToday, startOfDay } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Inbox,
} from "lucide-react";

import { TaskRow } from "@/features/tasks/task-row/task-row";
import { useTaskRowActions } from "@/features/tasks/task-row/use-task-row-actions";
import { flatListClassName } from "@/lib/flat-surface";

interface InboxTaskListProps {
  tasks: Doc<"tasks">[];
  onProcess?: (task: Doc<"tasks">) => void;
}

export function InboxTaskList({ tasks, onProcess }: InboxTaskListProps) {
  const open = tasks.filter((task) => task.state === "open");
  const done = tasks.filter((task) => task.state === "done");
  const today = startOfDay(new Date());
  const overdue = open.filter(
    (task) => task.when !== undefined && isBefore(task.when, today),
  );
  const dueToday = open.filter(
    (task) => task.when !== undefined && isToday(task.when),
  );
  const upcoming = open.filter(
    (task) =>
      task.when !== undefined &&
      !isBefore(task.when, today) &&
      !isToday(task.when),
  );
  const unscheduled = open.filter((task) => task.when === undefined);

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Inbox schedule
            </h1>
            <span className="ml-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {open.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Captures arranged by when they need your attention.
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </header>

      {open.length === 0 ? (
        <InboxZero />
      ) : (
        <div className="flex flex-col gap-6">
          <TaskSection
            icon={Clock3}
            title="Past due"
            tasks={overdue}
            onProcess={onProcess}
            tone="attention"
          />
          <TaskSection
            icon={CircleDot}
            title="Today"
            tasks={dueToday}
            onProcess={onProcess}
          />
          <TaskSection
            icon={CalendarClock}
            title="Coming up"
            tasks={upcoming}
            onProcess={onProcess}
          />
          <TaskSection
            icon={Inbox}
            title="No date"
            tasks={unscheduled}
            onProcess={onProcess}
          />
          <DoneTasks tasks={done} />
        </div>
      )}
    </div>
  );
}

function TaskSection({
  icon,
  title,
  tasks,
  onProcess,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  tasks: Doc<"tasks">[];
  onProcess?: (task: Doc<"tasks">) => void;
  tone?: "attention";
}) {
  if (tasks.length === 0) return null;

  return (
    <section>
      <SectionHeading
        icon={icon}
        title={title}
        count={tasks.length}
        tone={tone}
      />
      <div className={cn("mt-3", flatListClassName)}>
        {tasks.map((task) => (
          <InboxTaskRow key={task._id} task={task} onProcess={onProcess} />
        ))}
      </div>
    </section>
  );
}

function DoneTasks({ tasks }: { tasks: Doc<"tasks">[] }) {
  if (tasks.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        <CheckCircle2 className="size-3.5" />
        <span>Completed</span>
        <span className="ml-auto text-xs tabular-nums">{tasks.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={flatListClassName}>
          {tasks.map((task) => (
            <InboxTaskRow key={task._id} task={task} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  tone?: "attention";
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={cn(
          "size-3.5 text-muted-foreground",
          tone === "attention" && "text-condition-attention",
        )}
      />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function InboxZero() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
      <CheckCircle2 className="mb-3 size-7 text-muted-foreground" />
      <h2 className="text-sm font-semibold">Inbox zero</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing is waiting for a decision.
      </p>
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
