import type { Task, TaskId, Thread } from "@vita-os/contracts";

import {
  taskDateLabels,
  timeToken,
} from "@vita-os/application/internal/attention-list/index.ts";
import { EditableField } from "@vita-os/application/internal/ui/editable-field.tsx";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarClock,
  ChevronUp,
  MessageSquarePlus,
  Plus,
  Repeat as RepeatIcon,
  SkipForward,
  Target,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  ActionChip,
  AddTaskLine,
  bySoonest,
  CompleteCircle,
  DateToken,
  dayWord,
  NoteLine,
  type TaskList,
  TaskDatePicker,
  TaskMenu,
  TasksHeading,
  toneClass,
  useHiddenDateAnchor,
  useTaskList,
  useTaskRow,
} from "./parts";

/** The text as the shipped row edits it: click to edit, and it wraps in full. */
function TaskText({
  task,
  busy,
  onSave,
}: {
  task: Task;
  busy: boolean;
  onSave: (text: string) => void;
}) {
  return (
    <EditableField
      value={task.text}
      onSave={onSave}
      inputAriaLabel="Task"
      disabled={busy}
      className="min-h-0 py-0.5 text-sm leading-snug"
      displayClassName="border-transparent hover:bg-transparent"
    />
  );
}

/** On the wide rail a control waits for the row's hover or focus; on touch it is always there. */
const ON_ROW_HOVER =
  "xl:opacity-0 xl:group-hover/task:opacity-100 xl:group-focus-within/task:opacity-100 xl:data-popup-open:opacity-100";

function TaskSection({
  list,
  children,
}: {
  list: TaskList;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Thread attention"
      className="flex shrink-0 flex-col gap-1"
    >
      <TasksHeading count={list.tasks.length} />
      {list.tasks.length > 0 && (
        <ul aria-label="Tasks" className="flex flex-col gap-0.5">
          {children}
        </ul>
      )}
      <AddTaskLine list={list} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Checklist                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Complete leads, as in every checklist. The text has the row to itself and
 * wraps in full; a date, and the focus, sit on a quiet line under it. Every
 * other command is behind one ⋯ at the end. One list, in capture order.
 */
export function ChecklistTasks({ thread }: { thread: Thread }) {
  const list = useTaskList(thread);
  return (
    <TaskSection list={list}>
      {list.tasks.map((task) => (
        <ChecklistRow key={task._id} list={list} task={task} />
      ))}
    </TaskSection>
  );
}

function ChecklistRow({ list, task }: { list: TaskList; task: Task }) {
  const row = useTaskRow(list, task);
  const picker = useHiddenDateAnchor();

  return (
    <li
      aria-busy={row.busy || undefined}
      className={cn(
        "group/task relative flex flex-col rounded-lg px-1 py-1 transition-colors motion-reduce:transition-none",
        row.focused ? "bg-brand-accent/12" : "hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <CompleteCircle row={row} />
        <div className="min-w-0 flex-1 py-1 xl:py-0">
          <TaskText task={task} busy={row.busy} onSave={row.edit} />
          {(row.when !== undefined || row.focused) && (
            <div className="-ml-1 flex flex-wrap items-center gap-x-2 pb-0.5">
              {row.when !== undefined && (
                <TaskDatePicker row={row} trigger={<DateToken row={row} />} />
              )}
              {row.focused && (
                <span className="inline-flex items-center gap-1 px-1 text-xs text-brand-accent-text">
                  <Target aria-hidden className="size-3" />
                  Focus
                </span>
              )}
            </div>
          )}
        </div>
        <TaskMenu row={row} onDate={picker.open} className={ON_ROW_HOVER} />
      </div>
      <TaskDatePicker row={row} trigger={picker.anchor} />
      <NoteLine list={list} row={row} className="mt-1 ml-9 xl:ml-7" />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Open to act                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A closed row is only what it says: complete, the text, and its date. Click
 * the text to open the Task; open, its text is editable and every command is
 * spelled out under it. One Task is open at a time. One list, in capture
 * order.
 */
export function OpenToActTasks({ thread }: { thread: Thread }) {
  const list = useTaskList(thread);
  const [open, setOpen] = useState<TaskId | null>(null);
  return (
    <TaskSection list={list}>
      {list.tasks.map((task) => (
        <OpenToActRow
          key={task._id}
          list={list}
          task={task}
          open={open === task._id}
          onOpenChange={(next) => setOpen(next ? task._id : null)}
        />
      ))}
    </TaskSection>
  );
}

function OpenToActRow({
  list,
  task,
  open,
  onOpenChange,
}: {
  list: TaskList;
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const row = useTaskRow(list, task);

  if (!open) {
    return (
      <li
        aria-busy={row.busy || undefined}
        className={cn(
          "flex items-start gap-1.5 rounded-lg px-1 py-1 transition-colors motion-reduce:transition-none",
          row.focused ? "bg-brand-accent/12" : "hover:bg-muted/40",
        )}
      >
        <CompleteCircle row={row} />
        <button
          type="button"
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className={cn(
            "min-w-0 flex-1 rounded-md py-1.5 text-left text-sm leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring/40 xl:py-0.5",
            row.focused && "font-medium",
          )}
        >
          {task.text}
        </button>
        {row.when !== undefined && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 pt-2 text-xs tabular-nums xl:pt-1",
              toneClass(row),
            )}
          >
            {task.repeat !== undefined && (
              <RepeatIcon aria-hidden className="size-3" />
            )}
            {row.when}
          </span>
        )}
      </li>
    );
  }

  return (
    <li
      aria-busy={row.busy || undefined}
      data-keeps-escape=""
      onKeyDown={(event) => {
        if (event.key === "Escape" && !row.noting) {
          event.preventDefault();
          onOpenChange(false);
        }
      }}
      className={cn(
        "my-1 flex flex-col gap-1 rounded-xl p-1 ring-1 ring-border/70",
        row.focused ? "bg-brand-accent/12" : "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <CompleteCircle row={row} />
        <div className="min-w-0 flex-1 py-1 xl:py-0">
          <TaskText task={task} busy={row.busy} onSave={row.edit} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-0.5 pl-8 xl:pl-6">
        <TaskDatePicker
          row={row}
          trigger={
            <ActionChip
              icon={
                task.repeat === undefined ? <CalendarClock /> : <RepeatIcon />
              }
              disabled={row.busy}
              className={row.when === undefined ? undefined : toneClass(row)}
            >
              {row.when ?? "Add date"}
            </ActionChip>
          }
        />
        <ActionChip
          icon={<Target />}
          active={row.focused}
          aria-pressed={row.focused}
          disabled={row.busy}
          onClick={row.toggleFocus}
        >
          {row.focused ? "Focused" : "Focus"}
        </ActionChip>
        {task.repeat !== undefined && (
          <ActionChip
            icon={<SkipForward />}
            disabled={row.busy}
            onClick={row.skip}
          >
            Skip
          </ActionChip>
        )}
        <ActionChip
          icon={<MessageSquarePlus />}
          active={row.noting}
          disabled={row.busy}
          onClick={row.toggleNote}
        >
          Note
        </ActionChip>
        <span className="ml-auto flex items-center">
          <ActionChip
            icon={<Trash2 />}
            aria-label="Remove task"
            title="Remove"
            disabled={row.busy}
            onClick={row.remove}
            className="hover:text-destructive"
          />
          <ActionChip
            icon={<ChevronUp />}
            aria-label="Close task"
            title="Close (Esc)"
            onClick={() => onOpenChange(false)}
          />
        </span>
      </div>
      <NoteLine list={list} row={row} className="mx-1 mb-1" />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating toolbar                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The row reserves no room for commands at all: they float in a small pill
 * over its top edge while it is hovered or focused, the way chat apps act on
 * a message. The text and its date get the whole width. One list, in capture
 * order.
 */
export function FloatingTasks({ thread }: { thread: Thread }) {
  const list = useTaskList(thread);
  return (
    <TaskSection list={list}>
      {list.tasks.map((task) => (
        <FloatingRow key={task._id} list={list} task={task} />
      ))}
    </TaskSection>
  );
}

function FloatingRow({ list, task }: { list: TaskList; task: Task }) {
  const row = useTaskRow(list, task);
  const iconButton =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 data-popup-open:bg-muted data-popup-open:text-foreground xl:size-7 [&_svg]:size-3.5";

  return (
    <li
      aria-busy={row.busy || undefined}
      className={cn(
        "group/task relative flex flex-col rounded-lg px-1 py-1 transition-colors motion-reduce:transition-none",
        row.focused
          ? "bg-brand-accent/12"
          : "hover:bg-muted/40 focus-within:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <CompleteCircle row={row} />
        <div className="min-w-0 flex-1 py-1 xl:py-0">
          <TaskText task={task} busy={row.busy} onSave={row.edit} />
          {row.when !== undefined && (
            <div className="-ml-1 pb-0.5">
              <TaskDatePicker row={row} trigger={<DateToken row={row} />} />
            </div>
          )}
        </div>
      </div>
      <div
        role="toolbar"
        aria-label={`Actions for “${task.text}”`}
        className="pointer-events-none absolute -top-4 right-1 z-10 flex items-center gap-0.5 rounded-full border bg-popover p-0.5 opacity-0 shadow-md transition-opacity group-focus-within/task:pointer-events-auto group-focus-within/task:opacity-100 group-hover/task:pointer-events-auto group-hover/task:opacity-100 has-data-popup-open:pointer-events-auto has-data-popup-open:opacity-100 motion-reduce:transition-none"
      >
        <TaskDatePicker
          row={row}
          trigger={
            <button
              type="button"
              disabled={row.busy}
              aria-label={
                row.when === undefined
                  ? taskDateLabels.set
                  : taskDateLabels.change
              }
              title={
                row.when === undefined
                  ? taskDateLabels.set
                  : taskDateLabels.change
              }
              className={iconButton}
            >
              <CalendarClock />
            </button>
          }
        />
        <button
          type="button"
          disabled={row.busy}
          aria-pressed={row.focused}
          aria-label={row.focused ? "Unfocus this task" : "Focus this task"}
          title={row.focused ? "Unfocus" : "Focus"}
          onClick={row.toggleFocus}
          className={cn(iconButton, row.focused && "text-brand-accent-text")}
        >
          <Target />
        </button>
        {task.repeat !== undefined && (
          <button
            type="button"
            disabled={row.busy}
            aria-label="Skip task"
            title="Skip to the next date"
            onClick={row.skip}
            className={iconButton}
          >
            <SkipForward />
          </button>
        )}
        <button
          type="button"
          disabled={row.busy}
          aria-label="Complete with a note"
          aria-expanded={row.noting}
          title="Complete with a note"
          onClick={row.toggleNote}
          className={iconButton}
        >
          <MessageSquarePlus />
        </button>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          disabled={row.busy}
          aria-label="Remove task"
          title="Remove"
          onClick={row.remove}
          className={cn(iconButton, "hover:text-destructive")}
        >
          <Trash2 />
        </button>
      </div>
      <NoteLine list={list} row={row} className="mt-1 ml-9 xl:ml-7" />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Agenda                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The date becomes a column on the left, the way a calendar's agenda reads:
 * soonest first, and the undated ones after with an empty gutter, so there is
 * no divider to cross. The gutter is the date picker. The rest is behind ⋯.
 */
export function AgendaTasks({ thread }: { thread: Thread }) {
  const list = useTaskList(thread);
  return (
    <TaskSection list={list}>
      {bySoonest(list.tasks).map((task) => (
        <AgendaRow key={task._id} list={list} task={task} />
      ))}
    </TaskSection>
  );
}

function AgendaRow({ list, task }: { list: TaskList; task: Task }) {
  const row = useTaskRow(list, task);
  const picker = useHiddenDateAnchor();
  const time = task.date === undefined ? undefined : timeToken(task.date);

  return (
    <li
      aria-busy={row.busy || undefined}
      className={cn(
        "group/task relative flex flex-col rounded-lg px-1 py-1 transition-colors motion-reduce:transition-none",
        row.focused ? "bg-brand-accent/12" : "hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-1">
        <div className="w-[4.5rem] shrink-0">
          <TaskDatePicker
            row={row}
            trigger={
              task.date === undefined ? (
                <button
                  type="button"
                  disabled={row.busy}
                  aria-label={taskDateLabels.set}
                  title={taskDateLabels.set}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground/50 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 xl:h-6",
                    ON_ROW_HOVER,
                  )}
                >
                  <Plus className="size-3" />
                  Date
                </button>
              ) : (
                <button
                  type="button"
                  disabled={row.busy}
                  aria-label={`${taskDateLabels.change}: ${row.when}`}
                  title={taskDateLabels.change}
                  className="flex w-full flex-col items-start rounded-md px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 xl:py-0.5"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      toneClass(row, "text-foreground/80"),
                    )}
                  >
                    {dayWord(task.date, list.now)}
                    {task.repeat !== undefined && (
                      <RepeatIcon aria-hidden className="size-3 opacity-70" />
                    )}
                  </span>
                  {time !== undefined && (
                    <span className="text-2xs tabular-nums text-muted-foreground">
                      {time}
                    </span>
                  )}
                </button>
              )
            }
          />
        </div>
        <CompleteCircle row={row} />
        <div
          className={cn(
            "min-w-0 flex-1 py-1 xl:py-0",
            row.focused && "font-medium",
          )}
        >
          <TaskText task={task} busy={row.busy} onSave={row.edit} />
        </div>
        <TaskMenu row={row} onDate={picker.open} className={ON_ROW_HOVER} />
      </div>
      <TaskDatePicker row={row} trigger={picker.anchor} />
      <NoteLine
        list={list}
        row={row}
        className="mt-1 ml-[6.75rem] xl:ml-[6.25rem]"
      />
    </li>
  );
}
