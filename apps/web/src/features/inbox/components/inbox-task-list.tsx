import type { Doc } from "@convex/_generated/dataModel";

import { groupTasksByAttention } from "@convex/lib/attentionOrdering";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import {
  AttentionCollapsed,
  AttentionList,
  AttentionRow,
  type AttentionRowModel,
  RowDeleteAction,
  RowIconAction,
} from "@/features/attention-list";
import { useTaskRowActions } from "@/features/tasks/task-row/use-task-row-actions";

interface InboxTaskListProps {
  tasks: Doc<"tasks">[];
  onProcess?: (task: Doc<"tasks">) => void;
}

export function InboxTaskList({ tasks, onProcess }: InboxTaskListProps) {
  const now = Date.now();
  const groups = groupTasksByAttention(tasks, now);
  const openCount =
    groups.pastDue.length +
    groups.today.length +
    groups.noDate.length +
    groups.comingUp.length;
  const openTasks = [
    ...groups.pastDue,
    ...groups.today,
    ...groups.comingUp,
    ...groups.noDate,
  ];

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Inbox
          </h1>
          <span className="ml-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {openCount}
          </span>
        </div>
        <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
          {format(new Date(now), "EEEE, MMMM d")}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {openCount === 0 ? (
          <InboxZero />
        ) : (
          <AttentionList>
            {openTasks.map((task) => (
              <InboxTaskRow
                key={task._id}
                task={task}
                now={now}
                onProcess={onProcess}
              />
            ))}
          </AttentionList>
        )}

        {groups.completed.length > 0 && (
          <AttentionCollapsed title="Completed" count={groups.completed.length}>
            <AttentionList>
              {groups.completed.map((task) => (
                <InboxTaskRow key={task._id} task={task} now={now} />
              ))}
            </AttentionList>
          </AttentionCollapsed>
        )}
      </div>
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
  now,
  onProcess,
}: {
  task: Doc<"tasks">;
  now: number;
  onProcess?: (task: Doc<"tasks">) => void;
}) {
  const {
    handleRemove,
    handleToggleComplete,
    handleUpdateText,
    handleUpdateWhen,
    isDiscardPending,
    isSavingText,
    isTogglePending,
    isWhenPending,
  } = useTaskRowActions(task);
  const done = task.state === "done";

  const row: AttentionRowModel = {
    title: task.text,
    done,
    when: task.when,
    onToggleDone: handleToggleComplete,
    toggleBusy: isTogglePending,
    onSetWhen: handleUpdateWhen,
    whenBusy: isWhenPending,
    onUpdateText: handleUpdateText,
    isSavingText,
    actions: (
      <>
        {onProcess && !done && (
          <RowIconAction
            icon={ArrowRight}
            label="Process task"
            onSelect={() => onProcess(task)}
          />
        )}
        <RowDeleteAction
          label="Discard task"
          title="Discard task?"
          description="This task will be permanently removed from your Inbox. This action cannot be undone."
          confirmLabel="Discard"
          busy={isDiscardPending}
          onConfirm={handleRemove}
        />
      </>
    ),
  };

  return <AttentionRow now={now} row={row} />;
}
