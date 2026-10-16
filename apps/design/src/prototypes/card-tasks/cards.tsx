import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { Task, Thread } from "@vita-os/contracts";

import { Link } from "@tanstack/react-router";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
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
 * Every Task on the card, dated soonest first, then the undated ones in the
 * order they were captured. No focus.
 */
export function EveryTaskCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  return <TasksCard {...props} rows={[...datedFirst(tasks)]} />;
}

/**
 * The dated Tasks, soonest first, and how many have no date. With none dated
 * (in No date) the card names every Task, since there is no focus to pick one.
 */
export function DatedTasksCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  const dated = datedFirst(tasks).filter((task) => task.date !== undefined);
  if (dated.length === 0) return <TasksCard {...props} rows={tasks} />;
  return (
    <TasksCard
      {...props}
      rows={dated}
      more={tasks.length - dated.length}
      moreLabel="without a date"
    />
  );
}

/**
 * Every Task due on the day that placed the card, then one line for the next
 * dated Task after that day, then a count of the rest. In No date, a count.
 */
export function ThenCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  const { when, currentDate } = props;
  if (when === undefined) {
    return (
      <TasksCard
        {...props}
        rows={tasks.length === 1 ? tasks : []}
        more={tasks.length > 1 ? tasks.length : 0}
        moreLabel="tasks"
      />
    );
  }
  const placingDay = Math.max(dayDelta(when, currentDate), -1);
  const dayOf = (task: Task) => Math.max(dayDelta(task.date!, currentDate), -1);
  const sorted = datedFirst(tasks).filter((task) => task.date !== undefined);
  const due = sorted.filter((task) => dayOf(task) === placingDay);
  const next = sorted.find((task) => dayOf(task) > placingDay);
  const shown = due.length + (next === undefined ? 0 : 1);
  return (
    <TasksCard
      {...props}
      rows={due}
      then={next}
      more={tasks.length - shown}
      moreLabel="more"
    />
  );
}

/**
 * The Tasks due on this card's day; the board stands the Thread once on each
 * such day. In No date, every Task.
 */
export function DayCard(props: ThreadCardProps) {
  const tasks = props.thread.tasks ?? [];
  const { when, currentDate } = props;
  if (when === undefined) return <TasksCard {...props} rows={tasks} />;
  const day = Math.max(dayDelta(when, currentDate), -1);
  const due = tasks.filter(
    (task) =>
      task.date !== undefined &&
      Math.max(dayDelta(task.date, currentDate), -1) === day,
  );
  return <TasksCard {...props} rows={datedFirst(due)} />;
}

function datedFirst(tasks: readonly Task[]): Task[] {
  const dated = tasks
    .filter((task) => task.date !== undefined)
    .sort((a, b) => a.date! - b.date!);
  return [...dated, ...tasks.filter((task) => task.date === undefined)];
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
  rows,
  then,
  thread,
  when,
}: ThreadCardProps & {
  rows: readonly Task[];
  then?: Task;
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
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: thread.slug,
        })}
        className="line-clamp-2 min-w-0 text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {thread.title}
      </Link>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {rows.map((task) => (
            <TaskRow
              key={task._id}
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

      {then && (
        <p className="flex items-baseline gap-1.5 text-[12px] leading-snug text-muted-foreground">
          <span className="w-3 shrink-0" />
          <span className="shrink-0 tabular-nums">
            Then {dateToken(then.date!, currentDate)}
          </span>
          <span className="truncate">{then.text}</span>
        </p>
      )}

      {more > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/80">
          <ListTodo aria-hidden className="size-3 shrink-0 opacity-60" />
          {rows.length > 0 || then ? "+" : ""}
          {more} {moreLabel}
        </p>
      )}
    </BoardCard>
  );
}

function TaskRow({
  currentDate,
  inHeading,
  task,
  thread,
}: {
  currentDate: number;
  inHeading: boolean;
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
      <span className="line-clamp-2 min-w-0 flex-1 text-foreground/75">
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
