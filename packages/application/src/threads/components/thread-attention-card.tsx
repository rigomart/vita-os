import type {
  AreaSummary,
  Repeat,
  Task,
  TaskId,
  Thread,
} from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { attentionDate } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarClock,
  ListTodo,
  Repeat as RepeatIcon,
  SkipForward,
} from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import {
  repeatLabel,
  taskDateLabels,
  timeToken,
  withTimeToken,
} from "../../attention-list";
import { cardTask } from "../../dashboard/components/attention-board-model";
import {
  BoardCard,
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  BoardTag,
  concealed,
  isLate,
  revealed,
  showsBoardDate,
} from "../../dashboard/components/board-card";
import {
  dateToken,
  dateToneClassName,
  dayDelta,
} from "../../dashboard/components/dashboard-model";
import {
  useCompleteTask,
  useConversionLock,
  useSkipTask,
  useTaskDates,
} from "../use-tasks";

/** Past this many Tasks the pips stop growing and a count takes over. */
const MAX_PIPS = 6;

const noPendingTasks: ReadonlySet<TaskId> = new Set();

/**
 * One Thread on the board, in the three rows every `BoardCard` keeps.
 *
 * The first is always the Thread's title, so a card reads the same whether or
 * not a Task is focused. The second is the task slot (`taskSlot`): the dated
 * Task that placed the Thread, or two dated Tasks on one day as a count, or
 * without a dated Task the Focused Task, else the only Task, else how many
 * there are, because the card must not invent a headline the person never
 * chose. A Thread with no Tasks has no second row. The footer holds the date
 * and Area, so neither crowds the words above it.
 *
 * The date control sets the date of the Task the slot shows. On a card that
 * shows no single Task, setting a date adds a Task named "Follow up" with it.
 * The footer completes only the Task the slot shows, and skips it when it
 * repeats; a repeating Task wears the repeat glyph and its picker holds its
 * Repeat. Focusing, removing, and choosing among Tasks happen in Thread
 * detail, where every Task is in view.
 */
export function ThreadAttentionCard({
  actions,
  area,
  currentDate,
  dateInHeading = false,
  onAddFollowUp,
  onCompleteTask,
  onSetTaskDate,
  onSetTaskRepeat,
  onSkipTask,
  onTray,
  pendingTaskIds = noPendingTasks,
  locked = false,
  thread,
}: {
  actions?: ReactNode;
  area?: AreaSummary;
  currentDate: number;
  /** The group heading above already names this Thread's day. */
  dateInHeading?: boolean;
  /** Adds a Task named "Follow up" carrying the date. */
  onAddFollowUp: (when: number) => void;
  onCompleteTask: (taskId: TaskId) => void;
  /** Sets, changes or (with `null`) clears one Task's date. */
  onSetTaskDate: (taskId: TaskId, date: number | null) => void;
  /** Sets, changes or (with `null`) clears one Task's Repeat. */
  onSetTaskRepeat: (taskId: TaskId, repeat: Repeat | null) => void;
  /** Moves a repeating Task to its next occurrence. */
  onSkipTask: (taskId: TaskId) => void;
  onTray?: boolean;
  /** Tasks shown but not yet at the service. */
  pendingTaskIds?: ReadonlySet<TaskId>;
  /** A Note is being added to the Thread: no Task command until it settles. */
  locked?: boolean;
  thread: Thread;
}) {
  const tasks = thread.tasks ?? [];
  const placedBy = attentionDate(thread);
  const shown = cardTask(thread);
  const { slot, focused } = shown;
  const lead = shown.task;
  // What the picker holds: the shown Task's own date. A card with no single
  // Task opens it empty, and a date set there adds a Task.
  const taskDate = lead?.date;
  // While a Note is being added to the Thread, the card takes no Task
  // command: its date reads but does not open, and nothing can be completed.
  const leadPending = lead !== undefined && pendingTaskIds.has(lead._id);
  const showsDate = showsBoardDate(taskDate, dateInHeading);
  const showsPlacedDate =
    taskDate === undefined && showsBoardDate(placedBy, dateInHeading);
  const dateControl = locked ? (
    taskDate !== undefined && (
      <PlacedDate
        currentDate={currentDate}
        inHeading={dateInHeading}
        when={taskDate}
      />
    )
  ) : (
    <BoardDate
      currentDate={currentDate}
      inHeading={dateInHeading}
      labels={taskDateLabels}
      onSetWhen={(when) => {
        if (lead !== undefined) onSetTaskDate(lead._id, when ?? null);
        else if (when !== undefined) onAddFollowUp(when);
      }}
      {...(lead === undefined
        ? {}
        : {
            repeat: {
              value: lead.repeat,
              onChange: (repeat: Repeat | null) =>
                onSetTaskRepeat(lead._id, repeat),
            },
          })}
      when={taskDate}
    />
  );

  return (
    <BoardCard
      late={isLate(placedBy, currentDate)}
      onTray={onTray}
      footer={
        <>
          {showsDate && dateControl}
          {showsPlacedDate && (
            <PlacedDate
              currentDate={currentDate}
              inHeading={dateInHeading}
              when={placedBy!}
            />
          )}
          {area && (
            <BoardTag
              icon={<AreaIcon icon={area.icon} className="size-3 shrink-0" />}
              label={area.name}
            />
          )}

          {/* The pips and the controls share one slot, both flush right: the
              pips hold it at rest and hand it to the controls on hover, so
              neither floats in the space the other keeps. Pips only follow a
              Task the card shows; with none focused, the task slot already
              says how many there are. */}
          <span className="ml-auto grid shrink-0 justify-items-end pl-1 *:col-start-1 *:row-start-1">
            {tasks.length > 1 && lead !== undefined && focused && (
              <TaskPips
                className={cn("self-center", concealed)}
                tasks={tasks}
                focusedTaskId={lead._id}
              />
            )}
            <span className="flex items-center gap-1.5">
              {!showsDate && !locked && dateControl}
              {lead !== undefined && shown.canSkip && !locked && (
                <BoardControl
                  label={`Skip “${lead.text}” to its next date`}
                  onClick={() => onSkipTask(lead._id)}
                  className={revealed}
                >
                  <SkipForward className="size-3.5" />
                </BoardControl>
              )}
              {lead !== undefined && !locked && (
                <BoardCompleteButton
                  label={`Complete “${lead.text}”`}
                  onClick={() => onCompleteTask(lead._id)}
                />
              )}
              {actions && (
                <span className={cn("relative z-10 flex", revealed)}>
                  {actions}
                </span>
              )}
            </span>
          </span>
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

      {tasks.length > 0 && (
        <div className="flex items-start gap-1.5 text-[13px] leading-snug">
          <span
            aria-hidden
            className="flex h-[1.1rem] w-3 shrink-0 items-center justify-center"
          >
            {lead === undefined ? (
              <ListTodo className="size-3 text-muted-foreground/60" />
            ) : shown.marker === "repeat" ? (
              <RepeatIcon
                data-slot="repeat-glyph"
                className={cn(
                  "size-3",
                  focused
                    ? "text-brand-accent-strong"
                    : isLate(placedBy, currentDate)
                      ? "text-condition-attention"
                      : "text-muted-foreground",
                )}
              />
            ) : (
              <TaskMarker focused={focused} />
            )}
          </span>

          {slot.kind === "sameDay" ? (
            <span className="min-w-0 flex-1 text-muted-foreground/80">
              {slot.count} tasks{" "}
              {dayDelta(slot.date, currentDate) === 0 ? "today" : "that day"}
            </span>
          ) : lead === undefined ? (
            <span className="min-w-0 flex-1 text-muted-foreground/80">
              {tasks.length} tasks · none focused
            </span>
          ) : (
            <span
              aria-busy={leadPending || undefined}
              className={cn(
                "line-clamp-3 min-w-0 flex-1 text-foreground/75",
                leadPending && "opacity-60",
              )}
            >
              <span className="sr-only">
                {focused ? "Focused Task" : "Task"}
                {lead.repeat === undefined
                  ? ": "
                  : `, ${repeatLabel(lead.repeat).toLowerCase()}: `}
              </span>
              {lead.text}
              {leadPending && (
                <span className="text-muted-foreground"> · adding…</span>
              )}
            </span>
          )}
        </div>
      )}
    </BoardCard>
  );
}

export function ConnectedThreadAttentionCard({
  area,
  currentDate,
  dateInHeading,
  onTray,
  thread,
}: {
  area?: AreaSummary;
  currentDate: number;
  dateInHeading?: boolean;
  onTray?: boolean;
  thread: Thread;
}) {
  const completeTask = useCompleteTask(thread);
  const skipTask = useSkipTask(thread);
  const taskDates = useTaskDates(thread);
  const { locked, pendingTaskIds } = useConversionLock(thread);

  return (
    <ThreadAttentionCard
      locked={locked}
      pendingTaskIds={pendingTaskIds}
      area={area}
      currentDate={currentDate}
      dateInHeading={dateInHeading}
      onTray={onTray}
      thread={thread}
      onAddFollowUp={(when) => void taskDates.addFollowUp(when)}
      onCompleteTask={(taskId) => void completeTask(taskId)}
      onSetTaskDate={(taskId, date) => void taskDates.setDate(taskId, date)}
      onSetTaskRepeat={(taskId, repeat) =>
        void taskDates.setRepeat(taskId, repeat)
      }
      onSkipTask={(taskId) => void skipTask(taskId)}
    />
  );
}

/**
 * The date that placed a Thread whose card shows no single Task, as a token
 * in the footer. It is read-only: the card's date control beside it adds a
 * Task rather than change a date no one Task owns.
 */
function PlacedDate({
  currentDate,
  inHeading,
  when,
}: {
  currentDate: number;
  inHeading: boolean;
  when: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 tabular-nums",
        dateToneClassName(when, currentDate),
      )}
    >
      <CalendarClock aria-hidden className="size-3" />
      {inHeading
        ? timeToken(when)
        : withTimeToken(dateToken(when, currentDate), when)}
    </span>
  );
}

/** Filled for the Focused Task, hollow for an only Task nobody focused. */
function TaskMarker({ focused }: { focused: boolean }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        focused
          ? "bg-brand-accent-strong ring-2 ring-brand-accent/25"
          : "border border-muted-foreground/55",
      )}
    />
  );
}

/**
 * A quiet count of the Thread's Tasks: one pip each, the focused one filled.
 * It says there is more to the Thread than the Focused Task the card shows,
 * without listing any of it.
 */
function TaskPips({
  className,
  focusedTaskId,
  tasks,
}: {
  className?: string;
  focusedTaskId: TaskId;
  tasks: readonly Task[];
}) {
  const label = `${tasks.length} tasks, one focused`;
  const overflow = tasks.length - MAX_PIPS;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex items-center gap-[3px]", className)}
    >
      {tasks.slice(0, MAX_PIPS).map((task) => (
        <span
          key={task._id}
          className={cn(
            "size-1.5 rounded-full",
            task._id === focusedTaskId
              ? "bg-brand-accent-strong"
              : "border border-muted-foreground/50",
          )}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/70">
          +{overflow}
        </span>
      )}
    </span>
  );
}
