import type { Repeat, Task, TaskId } from "@vita-os/contracts";
import type { ComponentProps, ReactElement } from "react";

import { Button } from "@vita-os/ui/components/button";
import { Textarea } from "@vita-os/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { differenceInCalendarDays, format } from "date-fns";
import {
  CalendarClock,
  Check,
  MessageSquarePlus,
  Plus,
  Repeat as RepeatIcon,
  SkipForward,
  Trash2,
} from "lucide-react";
import { Fragment, useId, useRef, useState } from "react";

import {
  repeatLabel,
  taskDateLabels,
  WhenPopover,
  whenTone,
  withTimeToken,
} from "../../attention-list";
import { useFocusRecovery } from "../../ui/recover-focus";
import { TaskTextField } from "./task-text-field";

interface ThreadAttentionProps {
  /** Every Task, in the order it was captured. */
  tasks: readonly Task[];
  /** The shared attention clock, so lateness matches every other surface. */
  now: number;
  onAddTask: (text: string) => unknown;
  onEditTask: (taskId: TaskId, text: string) => unknown;
  onRemoveTask: (taskId: TaskId) => unknown;
  /** Tasks with a complete or skip on its way: they take no new note until it is answered. */
  completingTaskIds?: ReadonlySet<TaskId>;
  onCompleteTask: (taskId: TaskId) => unknown;
  /**
   * Completes the Task and captures the text (never blank; blank text
   * completes plainly) as a Thread Note, in one command. A failure is the
   * caller's to report, text included: this surface has let it go.
   */
  onCompleteTaskWithNote: (taskId: TaskId, body: string) => unknown;
  /** Sets, changes or (with `null`) clears one Task's date, and its Repeat with it. */
  onSetTaskDate: (taskId: TaskId, date: number | null) => unknown;
  /** Sets, changes or (with `null`) clears one dated Task's Repeat. */
  onSetTaskRepeat: (taskId: TaskId, repeat: Repeat | null) => unknown;
  /** Moves a repeating Task to its next occurrence. */
  onSkipTask: (taskId: TaskId) => unknown;
}

/**
 * The Thread's live attention: its Tasks as one list of peers, in the order
 * they were captured. A date never moves a Task; it is shown on the row.
 *
 * Each row leads with Complete, one click. The text has the row's width for
 * up to two lines, and all of it while edited. Under it, the date sits at the
 * left and the row's commands at the right, named by tooltips: Skip when the
 * Task repeats, the date, Complete with a note, and Remove.
 *
 * "Complete with a note" opens a line under the row; completing from there
 * also captures the text as a Thread Note. The text is held here while it is
 * written; once sent it is the caller's, which hands it back in a toast if the
 * completion fails.
 *
 * `xl` is the Thread pane's breakpoint (THREAD_PANE_BREAKPOINT): from there up
 * the pane is a rail, and a row's commands wait for its hover or focus in room
 * kept for them, so nothing shifts. Below it the Thread is a bottom drawer, so
 * every command stays visible and finger-sized.
 */
export function ThreadAttention({
  tasks,
  now,
  onAddTask,
  onEditTask,
  onRemoveTask,
  completingTaskIds,
  onCompleteTask,
  onCompleteTaskWithNote,
  onSetTaskDate,
  onSetTaskRepeat,
  onSkipTask,
}: ThreadAttentionProps) {
  const recoverFocus = useFocusRecovery();
  const section = useRef<HTMLElement>(null);
  const taskControl = (taskId: TaskId, label: string) => {
    const rows =
      section.current?.querySelectorAll<HTMLElement>("[data-task-id]");
    const row = Array.from(rows ?? []).find(
      (row) => row.dataset.taskId === taskId,
    );
    return row?.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  };
  const taskAction = (task: Task, label: string, run: () => unknown) => {
    const index = tasks.indexOf(task);
    const neighbor = tasks[index + 1] ?? tasks[index - 1];
    const target =
      (task.repeat && label === "Complete task"
        ? taskControl(task._id, label)
        : neighbor && taskControl(neighbor._id, label)) ??
      section.current?.querySelector<HTMLInputElement>(
        '[aria-label="Add a task"]',
      );
    return recoverFocus(() => target, run);
  };
  // The Task whose note line is open, and the text written for each Task.
  const [noting, setNoting] = useState<TaskId | null>(null);
  const [notes, setNotes] = useState<ReadonlyMap<TaskId, string>>(new Map());
  const keepNote = (taskId: TaskId, text: string | undefined) =>
    setNotes((current) => {
      const next = new Map(current);
      if (text === undefined) next.delete(taskId);
      else next.set(taskId, text);
      return next;
    });
  // A Task being completed takes no new note until the service answers.
  const busy = (taskId: TaskId) => completingTaskIds?.has(taskId) ?? false;
  // Sent, the text leaves this surface for good: if the completion fails,
  // it comes back in a toast, never here.
  const completeWithNote = (taskId: TaskId) => {
    if (busy(taskId)) return;
    const text = notes.get(taskId) ?? "";
    setNoting(null);
    keepNote(taskId, undefined);
    if (text.trim() === "") return onCompleteTask(taskId);
    return onCompleteTaskWithNote(taskId, text);
  };

  return (
    <section
      ref={section}
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

      {tasks.length > 0 && (
        <TooltipProvider delay={300}>
          <ul aria-label="Tasks" className="flex flex-col gap-0.5">
            {tasks.map((task) => (
              <Fragment key={task._id}>
                <TaskRow
                  task={task}
                  now={now}
                  disabled={busy(task._id)}
                  noting={noting === task._id}
                  onEdit={(text) => onEditTask(task._id, text)}
                  onRemove={() =>
                    taskAction(task, "Remove task", () =>
                      onRemoveTask(task._id),
                    )
                  }
                  onComplete={() =>
                    taskAction(task, "Complete task", () =>
                      onCompleteTask(task._id),
                    )
                  }
                  onToggleNote={() =>
                    setNoting((current) =>
                      current === task._id ? null : task._id,
                    )
                  }
                  onSetDate={(date) => onSetTaskDate(task._id, date)}
                  onSetRepeat={(repeat) => onSetTaskRepeat(task._id, repeat)}
                  onSkip={() => onSkipTask(task._id)}
                />
                {noting === task._id && (
                  <CompletionNoteLine
                    taskText={task.text}
                    text={notes.get(task._id) ?? ""}
                    disabled={busy(task._id)}
                    onChange={(text) => keepNote(task._id, text)}
                    onComplete={() =>
                      taskAction(task, "Complete task", () =>
                        completeWithNote(task._id),
                      )
                    }
                    onCancel={() =>
                      recoverFocus(
                        () => taskControl(task._id, "Complete with a note"),
                        () => {
                          setNoting(null);
                          keepNote(task._id, undefined);
                        },
                      )
                    }
                  />
                )}
              </Fragment>
            ))}
          </ul>
        </TooltipProvider>
      )}

      <AddTask onAdd={onAddTask} />
    </section>
  );
}

/**
 * One Task: a line, not a card. Complete leads; the text and, under it, the
 * date and the commands follow. A pending Task is dimmed and says so; a
 * disabled one takes no command.
 */
function TaskRow({
  task,
  now,
  disabled,
  noting,
  onEdit,
  onRemove,
  onComplete,
  onToggleNote,
  onSetDate,
  onSetRepeat,
  onSkip,
}: {
  task: Task;
  now: number;
  /** Whether it takes a command now: not while it is being completed. */
  disabled: boolean;
  /** Whether its note line is open beneath it. */
  noting: boolean;
  onEdit: (text: string) => unknown;
  onRemove: () => unknown;
  onComplete: () => unknown;
  onToggleNote: () => unknown;
  onSetDate: (date: number | null) => unknown;
  onSetRepeat: (repeat: Repeat | null) => unknown;
  onSkip: () => unknown;
}) {
  const action = useGuardedAsyncAction((run: () => unknown) => run(), {
    errorToast: false,
  });
  const dateAction = useGuardedAsyncAction(onSetDate, { errorToast: false });
  const repeatAction = useGuardedAsyncAction(onSetRepeat, {
    errorToast: false,
  });
  const busy =
    disabled ||
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending;
  const act = (run: () => unknown) => {
    if (!busy) void action.run(run);
  };
  const when = task.date === undefined ? undefined : taskWhen(task.date, now);
  const tone = whenTone(task.date, now);
  // The date token and the date command open the same picker.
  const datePicker = (trigger: ReactElement) => (
    <WhenPopover
      busy={busy}
      when={task.date}
      clearLabel={taskDateLabels.clear}
      keepOpenOnPick
      onSetWhen={(next) => dateAction.run(next ?? null)}
      repeat={{
        value: task.repeat,
        onChange: (repeat) => repeatAction.run(repeat),
      }}
      trigger={trigger}
    />
  );

  return (
    <li
      data-task-id={task._id}
      aria-busy={busy || undefined}
      className="group/task flex items-start gap-1.5 rounded-lg px-1 pt-1 pb-0.5 text-foreground/90 transition-colors hover:bg-muted/50 motion-reduce:transition-none"
    >
      <Command label="Complete">
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => act(onComplete)}
          aria-label="Complete task"
          className="group/complete flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-disabled:pointer-events-none aria-disabled:opacity-50 xl:size-6"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors group-hover/complete:border-condition-healthy group-hover/complete:bg-condition-healthy/10 motion-reduce:transition-none",
              tone === "overdue"
                ? "border-condition-attention/70"
                : "border-muted-foreground/45",
            )}
          >
            <Check
              strokeWidth={3}
              className="size-2.5 text-transparent group-hover/complete:text-condition-healthy"
            />
          </span>
        </button>
      </Command>

      <div className="min-w-0 flex-1 pt-1 xl:pt-0">
        <TaskTextField
          value={task.text}
          onSave={(text) => act(() => onEdit(text))}
          disabled={busy}
        />
        <div className="flex min-h-8 items-center gap-2 xl:min-h-7">
          <div className="-ml-1 flex min-w-0 flex-1 items-center">
            {when !== undefined &&
              datePicker(
                <button
                  type="button"
                  aria-disabled={busy || undefined}
                  onClickCapture={(event) => {
                    if (busy) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }}
                  aria-label={`${taskDateLabels.change}: ${when}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 aria-disabled:opacity-50",
                    tone ? DATE_TONE[tone] : "text-muted-foreground",
                  )}
                >
                  {task.repeat !== undefined && (
                    <span
                      role="img"
                      aria-label={repeatLabel(task.repeat)}
                      data-slot="repeat-glyph"
                      className="flex shrink-0 items-center"
                    >
                      <RepeatIcon aria-hidden className="size-3" />
                    </span>
                  )}
                  {when}
                </button>,
              )}
          </div>

          <div
            role="toolbar"
            aria-label="Task commands"
            className="-mr-1 flex shrink-0 items-center gap-0.5 transition-opacity motion-reduce:transition-none xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100 xl:has-data-popup-open:opacity-100"
          >
            {/* Skip leads, so the other commands keep their places from row to row. */}
            {task.repeat !== undefined && (
              <Command label="Skip to the next date">
                <CommandButton
                  aria-label="Skip task"
                  aria-disabled={busy || undefined}
                  onClick={() => act(onSkip)}
                >
                  <SkipForward />
                </CommandButton>
              </Command>
            )}
            <Tooltip>
              {datePicker(
                <TooltipTrigger
                  render={
                    <CommandButton
                      aria-label={
                        when === undefined
                          ? taskDateLabels.set
                          : taskDateLabels.change
                      }
                      aria-disabled={busy || undefined}
                    >
                      <CalendarClock />
                    </CommandButton>
                  }
                />,
              )}
              <TooltipContent>
                {when === undefined
                  ? taskDateLabels.set
                  : taskDateLabels.change}
              </TooltipContent>
            </Tooltip>

            <Command label="Complete with a note">
              <CommandButton
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (!busy) void onToggleNote();
                }}
                aria-label="Complete with a note"
                aria-expanded={noting}
                className={noting ? "bg-muted text-foreground" : undefined}
              >
                <MessageSquarePlus />
              </CommandButton>
            </Command>
            <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border" />
            <Command label="Remove">
              <CommandButton
                aria-disabled={busy || undefined}
                onClick={() => act(onRemove)}
                aria-label="Remove task"
                className="hover:text-destructive"
              >
                <Trash2 />
              </CommandButton>
            </Command>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Names the command it wraps in a tooltip; the button carries the rest. */
function Command({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CommandButton({
  className,
  children,
  onClickCapture,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-popup-open:bg-muted data-popup-open:text-foreground motion-reduce:transition-none xl:size-7 [&_svg]:size-3.5",
        className,
      )}
      {...props}
      onClickCapture={(event) => {
        if (props["aria-disabled"]) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClickCapture?.(event);
      }}
    >
      {children}
    </button>
  );
}

/** A Task's day as a word when it is near (Today, Tue) and a date when it is not, with its time. */
function taskWhen(when: number, now: number): string {
  const days = differenceInCalendarDays(when, now);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : days > 1 && days < 7
            ? format(when, "EEE")
            : format(when, "MMM d");
  return withTimeToken(day, when);
}

/**
 * The note line under a Task: what to keep from completing it, which joins
 * the Thread's Notes. Enter completes, Shift+Enter starts a new line, and
 * Escape (anywhere in it) or Cancel closes it and drops the text.
 */
function CompletionNoteLine({
  taskText,
  text,
  disabled,
  onChange,
  onComplete,
  onCancel,
}: {
  taskText: string;
  text: string;
  disabled: boolean;
  onChange: (text: string) => unknown;
  onComplete: () => unknown;
  onCancel: () => unknown;
}) {
  const fieldId = useId();
  const hintId = useId();

  return (
    <li className="pb-1.5 pl-[2.625rem] xl:pl-[2.125rem]">
      <div
        role="group"
        aria-label={`Complete “${taskText}” with a note`}
        data-slot="completion-note"
        // Its Escape closes it alone, never the Thread drawer around it.
        data-keeps-escape=""
        className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-2.5"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
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
          value={text}
          aria-disabled={disabled || undefined}
          readOnly={disabled}
          aria-describedby={hintId}
          placeholder="What happened?"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
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
            aria-disabled={disabled || undefined}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            onClick={() => {
              if (!disabled) void onComplete();
            }}
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
function AddTask({ onAdd }: { onAdd: (text: string) => unknown }) {
  const [draft, setDraftState] = useState("");
  const draftRef = useRef("");
  const pending = useRef(Promise.resolve());
  const setDraft = (text: string) => {
    draftRef.current = text;
    setDraftState(text);
  };

  const commit = () => {
    const text = draftRef.current.trim();
    if (!text) return;
    setDraft("");
    pending.current = pending.current.then(async () => {
      try {
        await onAdd(text);
      } catch {
        if (!draftRef.current) setDraft(text);
      }
    });
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
        data-keeps-escape=""
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
