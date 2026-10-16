import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { Repeat, Task, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

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
  showsBoardDate,
} from "@vita-os/application/internal/dashboard/components/board-card.tsx";
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
 * One copy of a Thread on the board, in the shipped card's three rows. On
 * the list the first row is the Task that placed the copy and the second its
 * Thread, so two copies of one Thread read as two things to do. In No date
 * the Thread leads, over its only Task or how many there are: with no Focus,
 * nothing else picks one. The footer holds the date and Area at the left and
 * the controls at the right, as it ships, so the words keep the full width.
 */
export function TaskFirstCard({
  area,
  currentDate,
  dateInHeading,
  onLateFill,
  task,
  thread,
}: ThreadCardProps) {
  const tasks = thread.tasks ?? [];
  // The Task the footer acts on: the copy's own, or in No date the only one.
  const lead = task ?? (tasks.length === 1 ? tasks[0] : undefined);
  const taskDates = useTaskDates(thread);
  const complete = useCompleteTask(thread);
  const skip = useSkipTask(thread);
  const completing = useCompletingTaskIds(thread);
  const busy = lead !== undefined && completing.has(lead._id);
  const showsDate = showsBoardDate(lead?.date, dateInHeading);

  const dateControl = (
    <BoardDate
      busy={busy}
      currentDate={currentDate}
      inHeading={dateInHeading}
      labels={taskDateLabels}
      onSetWhen={(when) => {
        if (lead !== undefined)
          return taskDates.setDate(lead._id, when ?? null);
        if (when !== undefined) return taskDates.addFollowUp(when);
      }}
      {...(lead === undefined
        ? {}
        : {
            repeat: {
              value: lead.repeat,
              onChange: (repeat: Repeat | null) =>
                taskDates.setRepeat(lead._id, repeat),
            },
          })}
      when={lead?.date}
    />
  );

  return (
    <BoardCard
      late={isLate(task?.date, currentDate)}
      onLateFill={onLateFill}
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
                disabled={busy}
                onClick={() => void skip(lead._id)}
                className={revealed}
              >
                <SkipForward className="size-3.5" />
              </BoardControl>
            )}
            {lead !== undefined && (
              <BoardCompleteButton
                label={`Complete “${lead.text}”`}
                disabled={busy}
                onClick={() => void complete(lead._id)}
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
                  <Marker task={lead} currentDate={currentDate} />
                )
              }
            >
              {lead === undefined ? (
                <span className="text-muted-foreground/80">
                  {tasks.length} tasks
                </span>
              ) : (
                <span className="line-clamp-3 text-foreground/75">
                  {lead.text}
                </span>
              )}
            </SecondRow>
          )}
        </>
      ) : (
        <>
          <p
            aria-busy={busy || undefined}
            className="flex items-start gap-1.5 text-sm leading-snug font-medium"
          >
            <span
              aria-hidden
              className="flex h-[1.2rem] w-3 shrink-0 items-center justify-center"
            >
              <Marker task={task} currentDate={currentDate} />
            </span>
            <span className="line-clamp-2 min-w-0 flex-1">
              <span className="sr-only">
                {task.repeat === undefined
                  ? "Task: "
                  : `Task, ${repeatLabel(task.repeat).toLowerCase()}: `}
              </span>
              {task.text}
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

/** The repeat glyph for a repeating Task, else a hollow dot. */
function Marker({ currentDate, task }: { currentDate: number; task: Task }) {
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
