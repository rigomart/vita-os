import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { Task, Thread } from "@vita-os/contracts";

import { Link } from "@tanstack/react-router";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
import {
  timeToken,
  withTimeToken,
} from "@vita-os/application/internal/attention-list/date-parts.ts";
import { taskDateLabels } from "@vita-os/application/internal/attention-list/follow-up-date.ts";
import { repeatLabel } from "@vita-os/application/internal/attention-list/repeat.ts";
import {
  BoardCard,
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  BoardTag,
  isLate,
  revealed,
} from "@vita-os/application/internal/dashboard/components/board-card.tsx";
import {
  dateToken,
  dayDelta,
} from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "@vita-os/application/internal/threads/use-tasks.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { ListTodo, Repeat as RepeatIcon, SkipForward } from "lucide-react";

import type { ThreadCardProps } from "./board";

/**
 * The board stands a copy of the Thread's card on every dated Task; each copy
 * names the Task that placed it. In No date, the only Task or how many.
 */
export function PerTaskCard(props: ThreadCardProps) {
  if (props.task === undefined) return <UndatedCard {...props} />;
  return <TasksCard {...props} rows={[props.task]} />;
}

/**
 * A copy per dated Task that says where else the Thread stands: the other
 * dated Tasks' days, so the copies read as one Thread.
 */
export function AlsoCard(props: ThreadCardProps) {
  if (props.task === undefined) return <UndatedCard {...props} />;
  const also = (props.thread.tasks ?? [])
    .filter((task) => task.date !== undefined && task._id !== props.task!._id)
    .sort((a, b) => a.date! - b.date!);
  return <TasksCard {...props} rows={[props.task]} also={also} />;
}

/**
 * The same copies, but the Task leads and the Thread it belongs to sits in
 * the footer, so two copies of one Thread read as two different things.
 */
export function TaskFirstCard(props: ThreadCardProps) {
  if (props.task === undefined) return <UndatedCard {...props} />;
  return <TasksCard {...props} rows={[props.task]} lead="task" />;
}

/**
 * The board stands the Thread once on each day it has a Task due; the copy
 * names that day's Tasks. In No date, the only Task or how many.
 */
export function DayCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  const { when, currentDate } = props;
  if (when === undefined) return <UndatedCard {...props} />;
  const day = Math.max(dayDelta(when, currentDate), -1);
  const due = tasks
    .filter(
      (task) =>
        task.date !== undefined &&
        Math.max(dayDelta(task.date, currentDate), -1) === day,
    )
    .sort((a, b) => a.date! - b.date!);
  return <TasksCard {...props} rows={due} />;
}

/** Without Focus, a card in No date names its only Task, or counts them. */
function UndatedCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  if (tasks.length === 1) return <TasksCard {...props} rows={tasks} />;
  return (
    <TasksCard
      {...props}
      rows={[]}
      more={tasks.length}
      moreLabel={tasks.length === 1 ? "task" : "tasks"}
    />
  );
}

/**
 * A Thread's card that names Tasks as rows, each completed, skipped and dated
 * on its own row. The title stays the first row; the footer keeps the Area.
 */
function TasksCard({
  area,
  currentDate,
  dateInHeading,
  more = 0,
  moreLabel = "more",
  onLateFill,
  also = [],
  lead = "thread",
  rows,
  thread,
  when,
}: ThreadCardProps & {
  /** The Thread's other dated Tasks, named by day. */
  also?: readonly Task[];
  /** What heads the card: the Thread's title, or the Task that placed it. */
  lead?: "task" | "thread";
  rows: readonly Task[];
  more?: number;
  moreLabel?: string;
}) {
  const taskDates = useTaskDates(thread);
  const hasTasks = (thread.tasks ?? []).length > 0;
  return (
    <BoardCard
      late={isLate(when, currentDate)}
      onLateFill={onLateFill}
      footer={
        <>
          {lead === "task" && (
            <ThreadLink
              thread={thread}
              className="max-w-48 truncate text-[12px] text-muted-foreground"
            />
          )}
          {area && (
            <BoardTag
              icon={<AreaIcon icon={area.icon} className="size-3 shrink-0" />}
              label={area.name}
            />
          )}
          {!hasTasks && (
            <span className="ml-auto">
              <BoardDate
                currentDate={currentDate}
                labels={taskDateLabels}
                onSetWhen={(next) =>
                  next === undefined ? undefined : taskDates.addFollowUp(next)
                }
              />
            </span>
          )}
        </>
      }
    >
      {lead === "thread" && (
        <ThreadLink
          thread={thread}
          className="line-clamp-2 text-sm leading-snug font-medium"
        />
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {rows.map((task) => (
            <TaskRow
              key={task._id}
              leads={lead === "task"}
              currentDate={currentDate}
              inHeading={
                dateInHeading &&
                when !== undefined &&
                task.date !== undefined &&
                dayDelta(task.date, when) === 0
              }
              task={task}
              thread={thread}
            />
          ))}
        </ul>
      )}

      {also.length > 0 && (
        <p className="flex items-baseline gap-1.5 text-[12px] leading-snug text-muted-foreground">
          <span className="w-3 shrink-0" />
          <span className="truncate tabular-nums">
            Also{" "}
            {also
              .map((task) =>
                withTimeToken(dateToken(task.date!, currentDate), task.date!),
              )
              .join(" · ")}
          </span>
        </p>
      )}

      {more > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/80">
          <ListTodo aria-hidden className="size-3 shrink-0 opacity-60" />
          {rows.length > 0 ? "+" : ""}
          {more} {moreLabel}
        </p>
      )}
    </BoardCard>
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
        "min-w-0 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {thread.title}
    </Link>
  );
}

function TaskRow({
  currentDate,
  inHeading,
  leads = false,
  task,
  thread,
}: {
  currentDate: number;
  inHeading: boolean;
  /** The Task heads the card, in the title's weight. */
  leads?: boolean;
  task: Task;
  thread: Thread;
}) {
  const complete = useCompleteTask(thread);
  const skip = useSkipTask(thread);
  const taskDates = useTaskDates(thread);
  const busy = useCompletingTaskIds(thread).has(task._id);
  const repeats = task.repeat !== undefined;

  return (
    <li
      aria-busy={busy || undefined}
      className={cn(
        "group/row flex items-start gap-1.5 text-[13px] leading-snug",
        busy && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className="flex h-[1.1rem] w-3 shrink-0 items-center justify-center"
      >
        {repeats ? (
          <RepeatIcon
            className={cn(
              "size-3",
              isLate(task.date, currentDate)
                ? "text-condition-attention"
                : "text-muted-foreground",
            )}
          />
        ) : (
          <span className="size-1.5 rounded-full border border-muted-foreground/55" />
        )}
      </span>
      <span
        className={cn(
          "line-clamp-2 min-w-0 flex-1",
          leads ? "text-sm font-medium text-foreground" : "text-foreground/75",
        )}
      >
        <span className="sr-only">
          {repeats
            ? `Task, ${repeatLabel(task.repeat!).toLowerCase()}: `
            : "Task: "}
        </span>
        {task.text}
      </span>
      <span className="relative z-10 flex shrink-0 items-center gap-1 text-[12px]">
        <BoardDate
          busy={busy}
          currentDate={currentDate}
          inHeading={inHeading}
          labels={taskDateLabels}
          onSetWhen={(next) => taskDates.setDate(task._id, next ?? null)}
          repeat={{
            value: task.repeat,
            onChange: (repeat) => taskDates.setRepeat(task._id, repeat),
          }}
          when={task.date}
        />
        {repeats && (
          <BoardControl
            label={`Skip “${task.text}” to its next date`}
            disabled={busy}
            onClick={() => void skip(task._id)}
            className={revealed}
          >
            <SkipForward className="size-3.5" />
          </BoardControl>
        )}
        <BoardCompleteButton
          label={`Complete “${task.text}”`}
          disabled={busy}
          onClick={() => void complete(task._id)}
        />
      </span>
    </li>
  );
}

/**
 * A repeating Task as a pill at the top of its day: the rhythm, its Thread,
 * its time, and Complete on hover. Opening it opens the Thread.
 */
export function RhythmChip({
  currentDate,
  dateInHeading,
  task,
  thread,
}: {
  currentDate: number;
  dateInHeading: boolean;
  task: Task;
  thread: Thread;
}) {
  const complete = useCompleteTask(thread);
  const busy = useCompletingTaskIds(thread).has(task._id);
  const late = isLate(task.date, currentDate);
  return (
    <span
      className={cn(
        "group/card relative inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card py-1 pr-1 pl-2.5 text-[13px]",
        busy && "opacity-50",
      )}
    >
      <RepeatIcon
        aria-hidden
        className={cn(
          "size-3",
          late ? "text-condition-attention" : "text-muted-foreground",
        )}
      />
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: thread.slug,
        })}
        className="max-w-56 truncate outline-none after:absolute after:inset-0 after:rounded-full after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {task.text}
      </Link>
      <span className="max-w-32 truncate text-[12px] text-muted-foreground">
        {thread.title}
      </span>
      <span
        className={cn(
          "text-[12px] tabular-nums",
          late ? "text-condition-attention" : "text-muted-foreground",
        )}
      >
        {dateInHeading
          ? (timeToken(task.date!) ?? "")
          : withTimeToken(dateToken(task.date!, currentDate), task.date!)}
      </span>
      <BoardCompleteButton
        label={`Complete “${task.text}”`}
        disabled={busy}
        onClick={() => void complete(task._id)}
      />
    </span>
  );
}
