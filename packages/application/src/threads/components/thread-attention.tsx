import type { Repeat, Task, TaskId } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { Textarea } from "@vita-os/ui/components/textarea";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarClock,
  Check,
  MessageSquarePlus,
  Plus,
  Repeat as RepeatIcon,
  SkipForward,
  X,
} from "lucide-react";
import { Fragment, useId, useState } from "react";

import type { CompletionNoteOutcome } from "../use-tasks";

import {
  repeatLabel,
  taskDateLabels,
  WhenPopover,
  whenTone,
  withTimeToken,
} from "../../attention-list";
import { EditableField } from "../../ui/editable-field";

interface ThreadAttentionProps {
  /** Every Task, in the order it was captured. */
  tasks: readonly Task[];
  focusedTaskId?: TaskId;
  /** Tasks shown but not yet at the service — a Note being added — read as pending. */
  pendingTaskIds?: ReadonlySet<TaskId>;
  /**
   * While a Note is being added to the Thread, nothing on its Tasks can be
   * changed: every control is disabled, Add a task included.
   */
  locked?: boolean;
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onAddTask: (text: string) => void;
  onEditTask: (taskId: TaskId, text: string) => void;
  onRemoveTask: (taskId: TaskId) => void;
  onCompleteTask: (taskId: TaskId) => void;
  /**
   * Completes the Task and captures the text as a Thread Note, in one
   * command; blank text completes it plainly. The outcome says whether the
   * text is still needed.
   */
  onCompleteTaskWithNote: (
    taskId: TaskId,
    body: string,
  ) => Promise<CompletionNoteOutcome>;
  /** `null` unfocuses; a Task replaces any earlier focus. */
  onFocusTask: (taskId: TaskId | null) => void;
  /** Sets, changes or (with `null`) clears one Task's date, and its Repeat with it. */
  onSetTaskDate: (taskId: TaskId, date: number | null) => void;
  /** Sets, changes or (with `null`) clears one dated Task's Repeat. */
  onSetTaskRepeat: (taskId: TaskId, repeat: Repeat | null) => void;
  /** Moves a repeating Task to its next occurrence. */
  onSkipTask: (taskId: TaskId) => void;
}

/**
 * The Thread's live attention: its Tasks as one list of peers, each of which
 * may carry a date.
 *
 * Dated Tasks come first, soonest first (a date alone before the timed ones
 * of its day), then a quiet "No date" divider, then undated Tasks in capture
 * order. The divider shows only when both groups exist. Focus is a radio
 * down the left edge: pressing it focuses that Task, and pressing the filled
 * one unfocuses it. The Focused Task is tinted where it sits. Leaving every
 * Task unfocused is a fine answer — nothing here asks for a priority.
 *
 * Complete is one click. Beside it, "Complete with a note" opens a line
 * under the row; completing from there also captures the text as a Thread
 * Note. The text is held here, not in the row: a completed one-off row
 * leaves at once, and if the change rolls back the text returns with it.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail with room for hover affordances; below it the Thread is a
 * bottom drawer, so every control stays visible and finger-sized.
 */
export function ThreadAttention({
  tasks,
  focusedTaskId,
  pendingTaskIds,
  locked = false,
  now,
  onAddTask,
  onEditTask,
  onRemoveTask,
  onCompleteTask,
  onCompleteTaskWithNote,
  onFocusTask,
  onSetTaskDate,
  onSetTaskRepeat,
  onSkipTask,
}: ThreadAttentionProps) {
  // The Task whose note line is open, and the text written for each Task.
  const [noting, setNoting] = useState<TaskId | null>(null);
  const [notes, setNotes] = useState<ReadonlyMap<TaskId, NoteDraft>>(new Map());
  const keepNote = (taskId: TaskId, draft: NoteDraft | undefined) =>
    setNotes((current) => {
      const next = new Map(current);
      if (draft === undefined) next.delete(taskId);
      else next.set(taskId, draft);
      return next;
    });
  const completeWithNote = (taskId: TaskId) => {
    const text = notes.get(taskId)?.text ?? "";
    setNoting(null);
    void onCompleteTaskWithNote(taskId, text).then((outcome) => {
      if (outcome === "completed") keepNote(taskId, undefined);
      if (outcome === "kept" || outcome === "unconfirmed") {
        keepNote(taskId, { text, unreached: outcome === "unconfirmed" });
        // Back under its row, unless another note line was opened meanwhile.
        setNoting((current) => current ?? taskId);
      }
    });
  };

  const dated = tasks
    .filter((task) => task.date !== undefined)
    .sort((a, b) => a.date! - b.date!);
  const undated = tasks.filter((task) => task.date === undefined);
  const renderTask = (task: Task) => (
    <Fragment key={task._id}>
      <TaskRow
        // Remounted when the lock starts or ends, which closes an open date
        // picker or text editor on the row.
        key={locked ? "locked" : "open"}
        task={task}
        now={now}
        focused={task._id === focusedTaskId}
        pending={pendingTaskIds?.has(task._id) ?? false}
        disabled={locked}
        noting={noting === task._id}
        onEdit={(text) => onEditTask(task._id, text)}
        onRemove={() => onRemoveTask(task._id)}
        onComplete={() => onCompleteTask(task._id)}
        onToggleNote={() =>
          setNoting((current) => (current === task._id ? null : task._id))
        }
        onSetDate={(date) => onSetTaskDate(task._id, date)}
        onSetRepeat={(repeat) => onSetTaskRepeat(task._id, repeat)}
        onSkip={() => onSkipTask(task._id)}
        onToggleFocus={() =>
          onFocusTask(task._id === focusedTaskId ? null : task._id)
        }
      />
      {noting === task._id && (
        <CompletionNoteLine
          taskText={task.text}
          draft={notes.get(task._id) ?? { text: "", unreached: false }}
          disabled={locked}
          onChange={(text) => keepNote(task._id, { text, unreached: false })}
          onComplete={() => completeWithNote(task._id)}
          onCancel={() => {
            setNoting(null);
            keepNote(task._id, undefined);
          }}
        />
      )}
    </Fragment>
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
      </div>

      {tasks.length > 1 && (
        <p className="px-0.5 pb-1 text-xs text-muted-foreground/65">
          Focus one when you know it, or leave them all unfocused.
        </p>
      )}

      {tasks.length > 0 && (
        <ul aria-label="Tasks" className="flex flex-col gap-0.5">
          {/* One keyed list, so a row that gains or loses its date moves
              rather than remounts, and its open date picker stays open. */}
          {[
            ...dated.map(renderTask),
            ...(dated.length > 0 && undated.length > 0
              ? [
                  <li
                    key="no-date"
                    role="presentation"
                    className="flex items-center gap-2 px-1.5 pt-1.5 pb-0.5"
                  >
                    <span className="text-2xs font-medium tracking-wide text-muted-foreground/60 uppercase">
                      No date
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-border/40" />
                  </li>,
                ]
              : []),
            ...undated.map(renderTask),
          ]}
        </ul>
      )}

      <AddTask onAdd={onAddTask} disabled={locked} />
    </section>
  );
}

/**
 * One Task: a line, not a card. The radio says whether it is the one; the
 * focused line is tinted in place so the list never reorders to show it. A
 * pending Task is dimmed and says so; a disabled one takes no command.
 */
function TaskRow({
  task,
  now,
  focused,
  pending,
  disabled,
  noting,
  onEdit,
  onRemove,
  onComplete,
  onToggleNote,
  onSetDate,
  onSetRepeat,
  onSkip,
  onToggleFocus,
}: {
  task: Task;
  now: number;
  focused: boolean;
  pending: boolean;
  disabled: boolean;
  /** Whether its note line is open beneath it. */
  noting: boolean;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onComplete: () => void;
  onToggleNote: () => void;
  onSetDate: (date: number | null) => void;
  onSetRepeat: (repeat: Repeat | null) => void;
  onSkip: () => void;
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
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "group/task flex min-h-10 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors motion-reduce:transition-none xl:min-h-9",
        focused
          ? "bg-brand-accent/12 font-medium"
          : "text-foreground/90 hover:bg-muted/50",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleFocus}
        aria-pressed={focused}
        aria-label={focused ? "Unfocus this task" : "Focus this task"}
        title={focused ? "Unfocus this task" : "Focus this task"}
        className="group/radio flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none xl:size-6"
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

      {task.repeat !== undefined && (
        <span
          role="img"
          aria-label={repeatLabel(task.repeat)}
          title={repeatLabel(task.repeat)}
          data-slot="repeat-glyph"
          className={cn(
            "flex shrink-0 items-center",
            tone === "overdue"
              ? "text-condition-attention"
              : "text-muted-foreground/70",
          )}
        >
          <RepeatIcon aria-hidden className="size-3" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <EditableField
          value={task.text}
          onSave={(text) => {
            if (text) onEdit(text);
          }}
          inputAriaLabel="Task"
          disabled={disabled}
          className="min-h-0 py-0.5 text-sm leading-snug"
          displayClassName="border-transparent hover:bg-transparent"
        />
      </span>

      {/* Always reachable on touch; on the wide rail the row stays clean until
          it is hovered or focused. */}
      <span className="flex shrink-0 items-center gap-0.5">
        {pending && (
          <span className="px-1 text-2xs text-muted-foreground">Adding…</span>
        )}
        <WhenPopover
          busy={disabled}
          when={task.date}
          clearLabel={taskDateLabels.clear}
          keepOpenOnPick
          onSetWhen={(when) => onSetDate(when ?? null)}
          repeat={{ value: task.repeat, onChange: onSetRepeat }}
          trigger={
            dateLabel === undefined ? (
              <Button
                variant="ghost"
                disabled={disabled}
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
                disabled={disabled}
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
                    tone ? DATE_TONE[tone] : "text-muted-foreground",
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
          disabled={disabled}
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove task"
          title="Remove"
          className="size-7 text-muted-foreground/50 transition-opacity hover:text-destructive motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100"
        >
          <X />
        </Button>
        {task.repeat !== undefined && (
          <Button
            variant="ghost"
            disabled={disabled}
            size="icon-xs"
            onClick={onSkip}
            aria-label="Skip task"
            title="Skip to the next date"
            className="size-7 text-muted-foreground/60 transition-opacity hover:text-foreground motion-reduce:transition-none xl:size-6 xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100"
          >
            <SkipForward />
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={disabled}
          size="icon-xs"
          onClick={onToggleNote}
          aria-label="Complete with a note"
          aria-expanded={noting}
          title="Complete with a note"
          className={cn(
            "size-7 transition-opacity hover:text-foreground motion-reduce:transition-none xl:size-6",
            noting
              ? "bg-muted text-foreground"
              : "text-muted-foreground/60 xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100",
          )}
        >
          <MessageSquarePlus />
        </Button>
        <Button
          variant="ghost"
          disabled={disabled}
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

/** The text written to complete a Task with, and whether the last try went unanswered. */
interface NoteDraft {
  text: string;
  unreached: boolean;
}

/**
 * The note line under a Task: what to keep from completing it, which joins
 * the Thread's Notes. Enter completes, Shift+Enter starts a new line, and
 * Escape or Cancel closes it and drops the text.
 */
function CompletionNoteLine({
  taskText,
  draft,
  disabled,
  onChange,
  onComplete,
  onCancel,
}: {
  taskText: string;
  draft: NoteDraft;
  disabled: boolean;
  onChange: (text: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const hintId = useId();

  return (
    <li className="pb-1.5 pl-10 xl:pl-8">
      <div
        role="group"
        aria-label={`Complete “${taskText}” with a note`}
        data-slot="completion-note"
        className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-2.5"
      >
        <label
          htmlFor={fieldId}
          className="text-xs font-medium text-muted-foreground"
        >
          Note
        </label>
        <Textarea
          id={fieldId}
          // Opened on purpose, to write in.
          autoFocus
          rows={2}
          value={draft.text}
          aria-describedby={hintId}
          placeholder="What happened?"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Closes the line, not the Thread pane around it.
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!disabled) onComplete();
            }
          }}
          className="min-h-14 rounded-md px-2 py-1.5 text-sm"
        />
        {draft.unreached && (
          <p role="status" className="text-xs text-condition-attention">
            Couldn’t reach Vita OS. Your note is kept here; complete again to
            try once more.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span id={hintId} className="text-xs text-muted-foreground">
            Saved to this thread’s notes
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="ml-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={onComplete}
          >
            <Check />
            Complete
          </Button>
        </div>
      </div>
    </li>
  );
}

/** The foot of the list: capture a Task with nothing to decide. */
function AddTask({
  onAdd,
  disabled,
}: {
  onAdd: (text: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
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
        disabled={disabled}
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
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
const DATE_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-text",
} as const;
