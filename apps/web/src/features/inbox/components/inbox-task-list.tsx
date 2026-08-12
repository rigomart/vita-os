import type { ProjectedTask } from "@convex/lib/validators";

import { groupTasksByAttention } from "@convex/lib/attentionOrdering";
import { Button } from "@vita-os/ui/components/button";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import {
  AttentionCollapsed,
  AttentionList,
  AttentionRow,
  type AttentionRowModel,
  RowDeleteAction,
  RowIconAction,
} from "@/features/attention-list";
import { useTaskRowActions } from "@/features/tasks/task-row/use-task-row-actions";
import { useAttentionClock } from "@/hooks/use-attention-clock";

interface InboxTaskListProps {
  tasks: ProjectedTask[];
  onProcess?: (task: ProjectedTask) => void;
  /** Done Tasks loaded so far from `tasks.listDone`. */
  doneTasks?: ProjectedTask[];
  /** Defaults to `true`: non-paginating callers render Completed only when non-empty. */
  isDoneExhausted?: boolean;
  canLoadMoreDone?: boolean;
  isLoadingMoreDone?: boolean;
  onLoadMoreDone?: () => void;
}

export function InboxTaskList({
  tasks,
  onProcess,
  doneTasks = [],
  isDoneExhausted = true,
  canLoadMoreDone = false,
  isLoadingMoreDone = false,
  onLoadMoreDone,
}: InboxTaskListProps) {
  const now = useAttentionClock();
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
  const showCompleted = doneTasks.length > 0 || !isDoneExhausted;

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

        {showCompleted && (
          <AttentionCollapsed title="Completed" count={doneTasks.length}>
            <AttentionList>
              {doneTasks.map((task) => (
                <InboxTaskRow key={task._id} task={task} now={now} />
              ))}
            </AttentionList>
            {(canLoadMoreDone || isLoadingMoreDone) && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={isLoadingMoreDone}
                  aria-busy={isLoadingMoreDone || undefined}
                  onClick={onLoadMoreDone}
                >
                  {isLoadingMoreDone ? (
                    <>
                      <Loader2
                        data-icon="inline-start"
                        className="size-3.5 animate-spin"
                      />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
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
  task: ProjectedTask;
  now: number;
  onProcess?: (task: ProjectedTask) => void;
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
