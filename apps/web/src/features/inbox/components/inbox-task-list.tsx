import type { Doc } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { groupTasksByAttention } from "@convex/lib/attentionOrdering";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
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
  const groups = groupTasksByAttention(tasks, Date.now());
  const openCount =
    groups.pastDue.length +
    groups.today.length +
    groups.noDate.length +
    groups.comingUp.length;

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Inbox
            </h1>
            <span className="ml-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {openCount}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks waiting for a decision or action, ordered by attention.
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {openCount === 0 ? (
          <InboxZero />
        ) : (
          <>
            <TaskSection
              icon={Clock3}
              title="Past due"
              tasks={groups.pastDue}
              onProcess={onProcess}
              tone="attention"
            />
            <TaskSection
              icon={CircleDot}
              title="Today"
              tasks={groups.today}
              onProcess={onProcess}
            />
            <TaskSection
              icon={Inbox}
              title="No date"
              tasks={groups.noDate}
              onProcess={onProcess}
            />
            <TaskSection
              icon={CalendarClock}
              title="Coming up"
              tasks={groups.comingUp}
              onProcess={onProcess}
            />
          </>
        )}
        <DoneTasks tasks={groups.completed} />
      </div>
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
      <SectionHeading icon={icon} title={title} tone={tone} />
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
  tone,
}: {
  icon: LucideIcon;
  title: string;
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
