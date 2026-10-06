import type { Task, TaskId } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { useState } from "react";

import {
  followUpDateLabels,
  taskDateLabels,
  WhenPopover,
  whenTone,
  withTimeToken,
} from "../../attention-list";
import { EditableField } from "../../ui/editable-field";

export interface ThreadAttentionPending {
  followUp?: boolean;
}

interface ThreadAttentionProps {
  /** Every Task, in the order it was captured. */
  tasks: readonly Task[];
  focusedTaskId?: TaskId;
  followUp: number | undefined;
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onAddTask: (text: string) => void;
  onEditTask: (taskId: TaskId, text: string) => void;
  onRemoveTask: (taskId: TaskId) => void;
  onCompleteTask: (taskId: TaskId) => void;
  /** `null` unfocuses; a Task replaces any earlier focus. */
  onFocusTask: (taskId: TaskId | null) => void;
  /** Sets, changes or (with `null`) clears one Task's date. */
  onSetTaskDate: (taskId: TaskId, date: number | null) => void;
  onSetFollowUp: (date: number) => void;
  onClearFollowUp: () => void;
  pending?: ThreadAttentionPending;
}

/**
 * The Thread's live attention: its Tasks as one list of peers, and the
 * Follow-up riding the list's rule.
 *
 * Dated Tasks come first, soonest first (a date alone before the timed ones
 * of its day), then a quiet "No date" divider, then undated Tasks in capture
 * order. The divider shows only when both groups exist. Focus is a radio
 * down the left edge: pressing it focuses that Task, and pressing the filled
 * one unfocuses it. The Focused Task is tinted where it sits. Leaving every
 * Task unfocused is a fine answer — nothing here asks for a priority.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail with room for hover affordances; below it the Thread is a
 * bottom drawer, so every control stays visible and finger-sized.
 */
export function ThreadAttention({
  tasks,
  focusedTaskId,
  followUp,
  now,
  onAddTask,
  onEditTask,
  onRemoveTask,
  onCompleteTask,
  onFocusTask,
  onSetTaskDate,
  onSetFollowUp,
  onClearFollowUp,
  pending,
}: ThreadAttentionProps) {
  const dated = tasks
    .filter((task) => task.date !== undefined)
    .sort((a, b) => a.date! - b.date!);
  const undated = tasks.filter((task) => task.date === undefined);
  const renderTask = (task: Task) => (
    <TaskRow
      key={task._id}
      task={task}
      now={now}
      focused={task._id === focusedTaskId}
      onEdit={(text) => onEditTask(task._id, text)}
      onRemove={() => onRemoveTask(task._id)}
      onComplete={() => onCompleteTask(task._id)}
      onSetDate={(date) => onSetTaskDate(task._id, date)}
      onToggleFocus={() =>
        onFocusTask(task._id === focusedTaskId ? null : task._id)
      }
    />
  );

  return (
    <section
      role="region"
      aria-label="Thread attention"
      data-slot="thread-attention"
      className="flex shrink-0 flex-col gap-1"
    >
      <div className="flex h-8 items-center gap-2 xl:h-7">
        <span className="shrink-0 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
          Tasks
        </span>
        {tasks.length > 0 && (
          <span className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground/60">
            {tasks.length}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <FollowUpSatellite
          followUp={followUp}
          now={now}
          onSet={onSetFollowUp}
          onClear={onClearFollowUp}
          isPending={pending?.followUp}
        />
      </div>

      {tasks.length > 1 && (
        <p className="px-0.5 pb-1 text-xs text-muted-foreground/65">
          Focus one when you know it, or leave them all unfocused.
        </p>
      )}

      {tasks.length > 0 && (
        <ul aria-label="Tasks" className="flex flex-col gap-0.5">
          {dated.map(renderTask)}
          {dated.length > 0 && undated.length > 0 && (
            <li
              role="presentation"
              className="flex items-center gap-2 px-1.5 pt-1.5 pb-0.5"
            >
              <span className="text-2xs font-medium tracking-wide text-muted-foreground/60 uppercase">
                No date
              </span>
              <span aria-hidden className="h-px flex-1 bg-border/40" />
            </li>
          )}
          {undated.map(renderTask)}
        </ul>
      )}

      <AddTask onAdd={onAddTask} />
    </section>
  );
}

/**
 * One Task: a line, not a card. The radio says whether it is the one; the
 * focused line is tinted in place so the list never reorders to show it.
 */
function TaskRow({
  task,
  now,
  focused,
  onEdit,
  onRemove,
  onComplete,
  onSetDate,
  onToggleFocus,
}: {
  task: Task;
  now: number;
  focused: boolean;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onComplete: () => void;
  onSetDate: (date: number | null) => void;
  onToggleFocus: () => void;
}) {
  const dateLabel =
    task.date === undefined
      ? undefined
      : withTimeToken(format(task.date, "MMM d"), task.date);
  const tone = whenTone(task.date, now);

  return (
    <li
      data-focused={focused || undefined}
      className={cn(
        "group/task flex min-h-10 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors motion-reduce:transition-none xl:min-h-9",
        focused
          ? "bg-brand-accent/12 font-medium"
          : "text-foreground/90 hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onToggleFocus}
        aria-pressed={focused}
        aria-label={focused ? "Unfocus this task" : "Focus this task"}
        title={focused ? "Unfocus this task" : "Focus this task"}
        className="group/radio flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 xl:size-6"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-3.5 items-center justify-center rounded-full border-[1.5px] transition-colors motion-reduce:transition-none",
            focused
              ? "border-brand-accent-strong"
              : "border-muted-foreground/50 group-hover/radio:border-brand-accent-strong",
          )}
        >
          {focused && (
            <span className="size-1.5 rounded-full bg-brand-accent-strong" />
          )}
        </span>
      </button>

      <span className="min-w-0 flex-1">
        <EditableField
          value={task.text}
          onSave={(text) => {
            if (text) onEdit(text);
          }}
          inputAriaLabel="Task"
          className="min-h-0 py-0.5 text-sm leading-snug"
          displayClassName="border-transparent hover:bg-transparent"
        />
      </span>

      {/* Always reachable on touch; on the wide rail the row stays clean until
          it is hovered or focused. */}
      <span className="flex shrink-0 items-center gap-0.5">
        <WhenPopover
          when={task.date}
          clearLabel={taskDateLabels.clear}
          onSetWhen={(when) => onSetDate(when ?? null)}
          trigger={
            dateLabel === undefined ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={taskDateLabels.set}
                title={taskDateLabels.set}
                className="size-7 text-muted-foreground/50 transition-opacity hover:text-foreground motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100"
              >
                <CalendarClock />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                aria-label={`${taskDateLabels.change}: ${dateLabel}`}
                title={taskDateLabels.change}
                className="h-7 gap-1 px-1.5 font-normal xl:h-6"
              >
                <CalendarClock
                  aria-hidden
                  className="size-3 text-muted-foreground/70"
                />
                <span
                  className={cn(
                    "tabular-nums",
                    tone ? FOLLOW_UP_TONE[tone] : "text-muted-foreground",
                  )}
                >
                  {dateLabel}
                </span>
              </Button>
            )
          }
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove task"
          title="Remove"
          className="size-7 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100"
        >
          <X />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onComplete}
          aria-label="Complete task"
          title="Complete"
          className="size-8 shrink-0 rounded-full border border-condition-healthy/40 text-transparent hover:bg-condition-healthy/10 hover:text-condition-healthy focus-visible:text-condition-healthy xl:size-6"
        >
          <Check />
        </Button>
      </span>
    </li>
  );
}

/** The foot of the list: capture a Task with nothing to decide. */
function AddTask({ onAdd }: { onAdd: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };

  return (
    <div className="flex min-h-9 items-center gap-2 px-1.5 xl:min-h-8">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50 xl:size-6"
      >
        <Plus className="size-3" />
      </span>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") setDraft("");
        }}
        aria-label="Add a task"
        placeholder="Add a task…"
        className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-0 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-border/60 focus:bg-muted/30 focus:px-1.5 motion-reduce:transition-none xl:h-7"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-up                                                                  */
/* -------------------------------------------------------------------------- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const FOLLOW_UP_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-text",
} as const;

/**
 * A satellite riding the list's rule: when this Thread should come back, not a
 * deadline on any one Task.
 */
function FollowUpSatellite({
  followUp,
  now,
  onSet,
  onClear,
  isPending,
}: {
  followUp: number | undefined;
  now: number;
  onSet: (date: number) => void;
  onClear: () => void;
  isPending?: boolean;
}) {
  const label =
    followUp === undefined
      ? undefined
      : withTimeToken(format(followUp, "MMM d"), followUp);
  const tone = whenTone(followUp, now);

  return (
    <span className="flex shrink-0 items-center">
      <WhenPopover
        when={followUp}
        busy={isPending}
        onSetWhen={(when) => (when === undefined ? onClear() : onSet(when))}
        trigger={
          <Button
            variant="ghost"
            size="xs"
            disabled={isPending}
            aria-label={
              label
                ? `${followUpDateLabels.change}: ${label}`
                : followUpDateLabels.set
            }
            className="h-8 gap-1.5 px-1.5 font-normal xl:h-6"
          >
            <CalendarClock
              aria-hidden
              className="size-3 text-muted-foreground/70"
            />
            {label ? (
              <span
                className={cn(
                  "tabular-nums",
                  tone ? FOLLOW_UP_TONE[tone] : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {followUpDateLabels.set}
              </span>
            )}
          </Button>
        }
      />

      {followUp !== undefined && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClear}
          disabled={isPending}
          aria-busy={isPending}
          aria-label={followUpDateLabels.clear}
          className="size-7 shrink-0 text-muted-foreground/50 hover:text-destructive xl:size-5"
        >
          <X />
        </Button>
      )}
    </span>
  );
}
