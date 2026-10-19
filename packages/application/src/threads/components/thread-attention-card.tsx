import type {
  AreaSummary,
  Repeat,
  Task,
  TaskId,
  Thread,
} from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { ListTodo, Repeat as RepeatIcon, SkipForward } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import { repeatLabel, taskDateLabels } from "../../attention-list";
import { cardTask } from "../../dashboard/components/attention-board-model";
import {
  BoardCard,
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  BoardTag,
  isLate,
  revealed,
  showsBoardDate,
} from "../../dashboard/components/board-card";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "../use-tasks";

/**
 * One copy of a Thread on the board, in the three rows every `BoardCard`
 * keeps.
 *
 * On the list a copy leads with the dated Task that placed it (`task`), after
 * the repeat glyph when it repeats or a hollow dot when it does not, and the
 * Thread's title sits under it, muted: two copies of one Thread read as two
 * things to do. In No date the Thread leads, over its only Task or how many
 * Tasks it has, because the card must not invent a headline the person never
 * chose. A Thread with no Tasks is its title alone. The footer holds the date
 * and Area, so neither crowds the words above it.
 *
 * Every control acts on the Task the card names (`cardTask`) and no other:
 * the date control sets its date and Repeat, Skip moves it when it repeats,
 * Complete completes it. A No date card naming no single Task offers no
 * Complete, and a date set there adds a Task named "Follow up" with it.
 * Removing and choosing among Tasks happen in Thread detail, where every Task
 * is in view.
 */
export function ThreadAttentionCard({
  area,
  completingTaskIds,
  currentDate,
  dateInHeading = false,
  onAddFollowUp,
  onCompleteTask,
  onSetTaskDate,
  onSetTaskRepeat,
  onSkipTask,
  task,
  thread,
}: {
  area?: AreaSummary;
  completingTaskIds?: ReadonlySet<TaskId>;
  currentDate: number;
  /** The group heading above already names this copy's day. */
  dateInHeading?: boolean;
  /** Adds a Task named "Follow up" carrying the date. */
  onAddFollowUp: (when: number) => unknown;
  onCompleteTask: (taskId: TaskId) => unknown;
  /** Sets, changes or (with `null`) clears one Task's date. */
  onSetTaskDate: (taskId: TaskId, date: number | null) => unknown;
  /** Sets, changes or (with `null`) clears one Task's Repeat. */
  onSetTaskRepeat: (taskId: TaskId, repeat: Repeat | null) => unknown;
  /** Moves a repeating Task to its next occurrence. */
  onSkipTask: (taskId: TaskId) => unknown;
  /** The dated Task that placed this copy on the list; none in No date. */
  task?: Task;
  thread: Thread;
}) {
  const tasks = thread.tasks ?? [];
  const lead = cardTask(thread, task);
  const action = useGuardedAsyncAction((run: () => unknown) => run(), {
    errorToast: false,
  });
  const dateAction = useGuardedAsyncAction(
    (when: number | undefined) => {
      if (lead !== undefined) return onSetTaskDate(lead._id, when ?? null);
      if (when !== undefined) return onAddFollowUp(when);
    },
    { errorToast: false },
  );
  const repeatAction = useGuardedAsyncAction(
    (repeat: Repeat | null) =>
      lead === undefined ? undefined : onSetTaskRepeat(lead._id, repeat),
    { errorToast: false },
  );
  const pending =
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending ||
    (lead !== undefined && (completingTaskIds?.has(lead._id) ?? false));
  const showsDate = showsBoardDate(lead?.date, dateInHeading);
  const dateControl = (
    <BoardDate
      busy={pending}
      currentDate={currentDate}
      inHeading={dateInHeading}
      labels={taskDateLabels}
      onSetWhen={(when) => dateAction.run(when)}
      {...(lead === undefined
        ? {}
        : {
            repeat: {
              value: lead.repeat,
              onChange: (repeat: Repeat | null) => repeatAction.run(repeat),
            },
          })}
      when={lead?.date}
    />
  );

  return (
    <BoardCard
      footer={
        <>
          {showsDate && dateControl}
          {area && (
            <BoardTag
              icon={<AreaIcon icon={area.icon} className="size-3 shrink-0" />}
              label={area.name}
            />
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {!showsDate && dateControl}
            {lead?.repeat !== undefined && (
              <BoardControl
                label={`Skip “${lead.text}” to its next date`}
                disabled={pending}
                onClick={() => void action.run(() => onSkipTask(lead._id))}
                className={revealed}
              >
                <SkipForward className="size-3.5" />
              </BoardControl>
            )}
            {lead !== undefined && (
              <BoardCompleteButton
                label={`Complete “${lead.text}”`}
                disabled={pending}
                onClick={() => void action.run(() => onCompleteTask(lead._id))}
              />
            )}
          </span>
        </>
      }
    >
      {task === undefined ? (
        <>
          <ThreadLink
            thread={thread}
            className="line-clamp-2 text-sm leading-snug font-medium"
          />
          {tasks.length > 0 && (
            <SecondRow
              marker={
                lead === undefined ? (
                  <ListTodo className="size-3 text-muted-foreground/60" />
                ) : (
                  <TaskMarker task={lead} currentDate={currentDate} />
                )
              }
            >
              {lead === undefined ? (
                <span className="text-muted-foreground/80">
                  {tasks.length} tasks
                </span>
              ) : (
                <span
                  aria-busy={pending || undefined}
                  className="line-clamp-3 text-foreground/75"
                >
                  <TaskText task={lead} />
                </span>
              )}
            </SecondRow>
          )}
        </>
      ) : (
        <>
          <p
            aria-busy={pending || undefined}
            className="flex items-start gap-1.5 text-sm leading-snug font-medium"
          >
            <span
              aria-hidden
              className="flex h-[1.2rem] w-3 shrink-0 items-center justify-center"
            >
              <TaskMarker task={task} currentDate={currentDate} />
            </span>
            <span className="line-clamp-2 min-w-0 flex-1">
              <TaskText task={task} />
            </span>
          </p>
          <SecondRow>
            <ThreadLink
              thread={thread}
              className="line-clamp-1 text-muted-foreground"
            />
          </SecondRow>
        </>
      )}
    </BoardCard>
  );
}

export function ConnectedThreadAttentionCard({
  area,
  currentDate,
  dateInHeading,
  task,
  thread,
}: {
  area?: AreaSummary;
  currentDate: number;
  dateInHeading?: boolean;
  task?: Task;
  thread: Thread;
}) {
  const completeTask = useCompleteTask(thread);
  const skipTask = useSkipTask(thread);
  const taskDates = useTaskDates(thread);
  const completingTaskIds = useCompletingTaskIds(thread);

  return (
    <ThreadAttentionCard
      completingTaskIds={completingTaskIds}
      area={area}
      currentDate={currentDate}
      dateInHeading={dateInHeading}
      task={task}
      thread={thread}
      onAddFollowUp={(when) => taskDates.addFollowUp(when)}
      onCompleteTask={(taskId) => completeTask(taskId)}
      onSetTaskDate={(taskId, date) => taskDates.setDate(taskId, date)}
      onSetTaskRepeat={(taskId, repeat) => taskDates.setRepeat(taskId, repeat)}
      onSkipTask={(taskId) => skipTask(taskId)}
    />
  );
}

/** The card's second row, indented to sit under the first row's words. */
function SecondRow({
  children,
  marker,
}: {
  children: ReactNode;
  marker?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5 text-[13px] leading-snug">
      <span
        aria-hidden
        className="flex h-[1.1rem] w-3 shrink-0 items-center justify-center"
      >
        {marker}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A Task's words, named as a Task, and its Repeat, for a screen reader. */
export function TaskText({ task }: { task: Task }) {
  return (
    <>
      <span className="sr-only">
        {task.repeat === undefined
          ? "Task: "
          : `Task, ${repeatLabel(task.repeat).toLowerCase()}: `}
      </span>
      {task.text}
    </>
  );
}

/** The repeat glyph for a repeating Task, else a hollow dot. */
export function TaskMarker({
  currentDate,
  task,
}: {
  currentDate: number;
  task: Task;
}) {
  return task.repeat === undefined ? (
    <span className="size-2 rounded-full border border-muted-foreground/55" />
  ) : (
    <RepeatIcon
      data-slot="repeat-glyph"
      className={cn(
        "size-3",
        isLate(task.date, currentDate)
          ? "text-condition-attention"
          : "text-muted-foreground",
      )}
    />
  );
}

/** The Thread's title, opening its pane; the whole card is its target. */
function ThreadLink({
  className,
  thread,
}: {
  className: string;
  thread: Thread;
}) {
  return (
    <Link
      to="."
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        thread: thread.slug,
      })}
      className={cn(
        "block min-w-0 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {thread.title}
    </Link>
  );
}
