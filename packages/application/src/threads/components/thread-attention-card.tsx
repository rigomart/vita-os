import type { AreaSummary, Task, TaskId, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { leadTask } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import { ListTodo } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import {
  BoardCard,
  BoardCompleteButton,
  BoardDate,
  BoardTag,
  concealed,
  isLate,
  revealed,
  showsBoardDate,
} from "../../dashboard/components/board-card";
import { useCompleteTask } from "../use-tasks";
import { useUpdateThread } from "../use-update-thread";

/** Past this many Tasks the pips stop growing and a count takes over. */
const MAX_PIPS = 6;

/**
 * One Thread on the board, in the three rows every `BoardCard` keeps.
 *
 * The first is always the Thread's title, so a card reads the same whether or
 * not a Task is focused. The second is the task slot: the Focused Task, else
 * the only Task, else — with several Tasks and none focused — just how many
 * there are, because the card must not invent a headline the person never
 * chose. A Thread with no Tasks has no second row. The footer holds the
 * Follow-up and Area, so neither crowds the words above it.
 *
 * The footer completes only the Task the slot shows. Focusing, removing, and
 * choosing among Tasks happen in Thread detail, where every Task is in view.
 */
export function ThreadAttentionCard({
  actions,
  area,
  currentDate,
  dateInHeading = false,
  onCompleteTask,
  onSetFollowUp,
  onTray,
  thread,
}: {
  actions?: ReactNode;
  area?: AreaSummary;
  currentDate: number;
  /** The group heading above already names this Thread's day. */
  dateInHeading?: boolean;
  onCompleteTask: (taskId: TaskId) => void;
  onSetFollowUp: (when: number | undefined) => void;
  onTray?: boolean;
  thread: Thread;
}) {
  const tasks = thread.tasks ?? [];
  const lead = leadTask(thread);
  const focused = lead !== undefined && lead._id === thread.focusedTaskId;
  const followUp = thread.followUp ?? undefined;
  const showsDate = showsBoardDate(followUp, dateInHeading);
  const followUpDate = (
    <BoardDate
      currentDate={currentDate}
      inHeading={dateInHeading}
      onSetWhen={onSetFollowUp}
      when={followUp}
    />
  );

  return (
    <BoardCard
      late={isLate(followUp, currentDate)}
      onTray={onTray}
      footer={
        <>
          {showsDate && followUpDate}
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
            {tasks.length > 1 && focused && (
              <TaskPips
                className={cn("self-center", concealed)}
                tasks={tasks}
                focusedTaskId={lead._id}
              />
            )}
            <span className="flex items-center gap-1.5">
              {!showsDate && followUpDate}
              {lead !== undefined && (
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
            ) : (
              <TaskMarker focused={focused} />
            )}
          </span>

          {lead === undefined ? (
            <span className="min-w-0 flex-1 text-muted-foreground/80">
              {tasks.length} tasks · none focused
            </span>
          ) : (
            <span className="line-clamp-3 min-w-0 flex-1 text-foreground/75">
              <span className="sr-only">
                {focused ? "Focused Task: " : "Task: "}
              </span>
              {lead.text}
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
  const updateThread = useUpdateThread(thread);

  return (
    <ThreadAttentionCard
      area={area}
      currentDate={currentDate}
      dateInHeading={dateInHeading}
      onTray={onTray}
      thread={thread}
      onCompleteTask={(taskId) => void completeTask(taskId)}
      onSetFollowUp={(when) => void updateThread({ followUp: when ?? null })}
    />
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
