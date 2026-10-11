import type { Repeat, Task, TaskId, Thread } from "@vita-os/contracts";
import type { ReactElement, ReactNode, Ref } from "react";

import {
  repeatLabel,
  taskDateLabels,
  timeToken,
  WhenPopover,
  whenTone,
} from "@vita-os/application/internal/attention-list/index.ts";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import {
  useCompletingTaskIds,
  useTasks,
} from "@vita-os/application/internal/threads/use-tasks.ts";
import { startOfLocalDay } from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarClock,
  Check,
  Ellipsis,
  MessageSquarePlus,
  Plus,
  Repeat as RepeatIcon,
  SkipForward,
  Target,
  Trash2,
} from "lucide-react";
import { useId, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* The list and its rows                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everything a direction needs to draw a Thread's Tasks with the product's
 * own commands: the Tasks, the clock, and the one note line that may be open.
 */
export function useTaskList(thread: Thread) {
  const now = useAttentionClock();
  const commands = useTasks(thread);
  const completing = useCompletingTaskIds(thread);
  const [noting, setNoting] = useState<TaskId | null>(null);
  const [notes, setNotes] = useState<ReadonlyMap<TaskId, string>>(new Map());
  const keepNote = (taskId: TaskId, text: string | undefined) =>
    setNotes((current) => {
      const next = new Map(current);
      if (text === undefined) next.delete(taskId);
      else next.set(taskId, text);
      return next;
    });

  return {
    tasks: thread.tasks ?? [],
    focusedTaskId: thread.focusedTaskId,
    now,
    commands,
    completing,
    noting,
    toggleNote: (taskId: TaskId) =>
      setNoting((current) => (current === taskId ? null : taskId)),
    noteText: (taskId: TaskId) => notes.get(taskId) ?? "",
    setNoteText: keepNote,
    cancelNote: (taskId: TaskId) => {
      setNoting(null);
      keepNote(taskId, undefined);
    },
    completeWithNote: (taskId: TaskId) => {
      const text = notes.get(taskId) ?? "";
      setNoting(null);
      keepNote(taskId, undefined);
      if (text.trim() === "") void commands.complete(taskId);
      else void commands.completeWithNote(taskId, text);
    },
  };
}

export type TaskList = ReturnType<typeof useTaskList>;

/** One Task's state and commands, guarded so a row takes one at a time. */
export function useTaskRow(list: TaskList, task: Task) {
  const action = useGuardedAsyncAction((run: () => unknown) => run(), {
    errorToast: false,
  });
  const busy = list.completing.has(task._id) || action.isPending;
  const act = (run: () => unknown) => void action.run(run);
  const { commands } = list;

  return {
    task,
    busy,
    focused: task._id === list.focusedTaskId,
    tone: whenTone(task.date, list.now),
    when: task.date === undefined ? undefined : whenText(task.date, list.now),
    noting: list.noting === task._id,
    complete: () => act(() => commands.complete(task._id)),
    skip: () => act(() => commands.skip(task._id)),
    remove: () => act(() => commands.remove(task._id)),
    edit: (text: string) => {
      if (text) act(() => commands.edit(task._id, text));
    },
    toggleFocus: () =>
      act(() =>
        commands.focus(task._id === list.focusedTaskId ? null : task._id),
      ),
    toggleNote: () => list.toggleNote(task._id),
    setDate: (date: number | undefined) =>
      action.run(() => commands.setDate(task._id, date ?? null)),
    setRepeat: (repeat: Repeat | null) =>
      action.run(() => commands.setRepeat(task._id, repeat)),
  };
}

export type TaskRowState = ReturnType<typeof useTaskRow>;

/** Soonest first, a date alone before the timed ones of its day; undated last, as captured. */
export function bySoonest(tasks: readonly Task[]): Task[] {
  const dated = tasks
    .filter((task) => task.date !== undefined)
    .sort((a, b) => a.date! - b.date!);
  return [...dated, ...tasks.filter((task) => task.date === undefined)];
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const DAY = 86_400_000;

/** Days from today, by the calendar. */
function dayOffset(when: number, now: number) {
  return Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / DAY);
}

/** A day as a word when it is near, Today, Tue, and as a date when it is not. */
export function dayWord(when: number, now: number): string {
  const days = dayOffset(when, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) {
    return new Date(when).toLocaleDateString("en-US", { weekday: "short" });
  }
  return new Date(when).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Today · 7 PM, Oct 22 · 9:30 AM, Tomorrow. */
export function whenText(when: number, now: number): string {
  const time = timeToken(when);
  const day = dayWord(when, now);
  return time === undefined ? day : `${day} · ${time}`;
}

/** Lateness reads in the tone the rest of the app uses for a slipping date. */
export const DATE_TONE = {
  overdue: "text-condition-attention",
  due: "text-brand-accent-text",
} as const;

export function toneClass(
  row: TaskRowState,
  fallback = "text-muted-foreground",
) {
  return row.tone ? DATE_TONE[row.tone] : fallback;
}

/** The product's date picker, on whatever trigger a direction draws. */
export function TaskDatePicker({
  row,
  trigger,
}: {
  row: TaskRowState;
  trigger: ReactElement;
}) {
  return (
    <WhenPopover
      busy={row.busy}
      when={row.task.date}
      clearLabel={taskDateLabels.clear}
      keepOpenOnPick
      onSetWhen={row.setDate}
      repeat={{ value: row.task.repeat, onChange: row.setRepeat }}
      trigger={trigger}
    />
  );
}

/** A Task's date as a quiet, clickable token, the repeat glyph inside it. */
export function DateToken({
  row,
  className,
  ...props
}: {
  row: TaskRowState;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      disabled={row.busy}
      aria-label={`${taskDateLabels.change}: ${row.when}`}
      title={taskDateLabels.change}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
        toneClass(row),
        className,
      )}
      {...props}
    >
      {row.task.repeat !== undefined && (
        <RepeatIcon
          aria-label={repeatLabel(row.task.repeat)}
          className="size-3 shrink-0"
        />
      )}
      {row.when}
    </button>
  );
}

/**
 * A trigger nobody sees, for a picker opened from a menu: it anchors the
 * picker under the menu button, and `open` clicks it once the menu has
 * closed.
 */
export function useHiddenDateAnchor(className = "top-9 right-2") {
  const ref = useRef<HTMLButtonElement>(null);
  return {
    anchor: (
      <button
        ref={ref}
        type="button"
        tabIndex={-1}
        // The picker hands focus back here when it closes, so it is not hidden.
        aria-label="Date"
        className={cn(
          "pointer-events-none absolute size-0 opacity-0",
          className,
        )}
      />
    ),
    open: () => window.setTimeout(() => ref.current?.click(), 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

/** Complete, the way every checklist leads: a circle that fills with a tick. */
export function CompleteCircle({
  row,
  className,
}: {
  row: TaskRowState;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={row.busy}
      onClick={row.complete}
      aria-label={`Complete “${row.task.text}”`}
      title="Complete"
      className={cn(
        "group/complete flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 xl:size-6",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors motion-reduce:transition-none",
          row.tone === "overdue"
            ? "border-condition-attention/70"
            : "border-muted-foreground/45",
          "group-hover/complete:border-condition-healthy group-hover/complete:bg-condition-healthy/10",
        )}
      >
        <Check
          strokeWidth={3}
          className="size-2.5 text-transparent group-hover/complete:text-condition-healthy"
        />
      </span>
    </button>
  );
}

/** Every other command on one Task, behind one button. */
export function TaskMenu({
  row,
  onDate,
  className,
}: {
  row: TaskRowState;
  /** Opens the row's date picker. */
  onDate: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={row.busy}
            aria-label={`More for “${row.task.text}”`}
            className={cn(
              "size-8 shrink-0 text-muted-foreground/60 hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground xl:size-6",
              className,
            )}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={row.toggleFocus}>
            <Target />
            {row.focused ? "Unfocus" : "Focus this task"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDate}>
            <CalendarClock />
            {row.task.date === undefined ? "Add a date…" : "Change date…"}
          </DropdownMenuItem>
          {row.task.repeat !== undefined && (
            <DropdownMenuItem onClick={row.skip}>
              <SkipForward />
              Skip to the next date
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={row.toggleNote}>
            <MessageSquarePlus />
            Complete with a note…
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={row.remove}>
          <Trash2 />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A small labelled command, for directions that spell their actions out. */
export function ActionChip({
  icon,
  children,
  active,
  className,
  ...props
}: {
  icon: ReactNode;
  children?: ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 xl:h-7 [&_svg]:size-3.5 [&_svg]:shrink-0",
        active && "bg-brand-accent/15 text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* The rest of the list                                                       */
/* -------------------------------------------------------------------------- */

export function TasksHeading({ count }: { count: number }) {
  return (
    <div className="flex h-8 items-center gap-2 xl:h-7">
      <span className="shrink-0 text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
        Tasks
      </span>
      {count > 0 && (
        <span className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
      <span aria-hidden className="h-px flex-1 bg-border/50" />
    </div>
  );
}

/**
 * The note line under a Task, as it ships: Enter completes, Shift+Enter starts
 * a new line, Escape or Cancel drops the text.
 */
export function NoteLine({
  list,
  row,
  className,
}: {
  list: TaskList;
  row: TaskRowState;
  className?: string;
}) {
  const fieldId = useId();
  const { task } = row;
  if (!row.noting) return null;

  return (
    <div
      role="group"
      aria-label={`Complete “${task.text}” with a note`}
      data-keeps-escape=""
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-2.5",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          list.cancelNote(task._id);
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
        autoFocus
        rows={2}
        value={list.noteText(task._id)}
        disabled={row.busy}
        placeholder="What happened?"
        onChange={(event) => list.setNoteText(task._id, event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!row.busy) list.completeWithNote(task._id);
          }
        }}
        className="min-h-14 rounded-md px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Saved to this thread’s notes
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => list.cancelNote(task._id)}
          className="ml-auto"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={row.busy}
          onClick={() => list.completeWithNote(task._id)}
        >
          <Check />
          Complete
        </Button>
      </div>
    </div>
  );
}

/** Capture with nothing to decide, as it ships. */
export function AddTaskLine({
  list,
  className,
}: {
  list: TaskList;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void list.commands.add(text);
  };

  return (
    <div
      className={cn(
        "flex min-h-9 items-center gap-2 px-1.5 xl:min-h-8",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center text-muted-foreground/50 xl:size-6"
      >
        <Plus className="size-3.5" />
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
