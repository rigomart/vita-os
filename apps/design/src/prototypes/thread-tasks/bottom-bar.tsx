import type { Task, Thread } from "@vita-os/contracts";
import type { ReactElement } from "react";

import { taskDateLabels } from "@vita-os/application/internal/attention-list/index.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import {
  CalendarClock,
  MessageSquarePlus,
  SkipForward,
  Target,
  Trash2,
} from "lucide-react";

import {
  AddTaskLine,
  CompleteCircle,
  DateToken,
  NoteLine,
  type TaskList,
  TaskDatePicker,
  TasksHeading,
  type TaskRowState,
  useTaskList,
  useTaskRow,
} from "./parts";
import { TaskTextField } from "./task-text-field";

/**
 * Complete leads; the text takes the full width for up to two lines, and
 * grows to all of it while edited. Under it, the date sits at the left and the
 * row's commands at the right, icons named by tooltips. One list, in capture
 * order.
 *
 * Skip, when a Task repeats, comes first, so the other commands keep their
 * places from row to row.
 *
 * `reveal`: on the wide rail the commands wait for the row's hover or focus,
 * in space kept for them so nothing shifts. On touch they always show.
 */
function BottomBarTasks({
  thread,
  reveal,
}: {
  thread: Thread;
  reveal: "on-hover" | "always";
}) {
  const list = useTaskList(thread);
  return (
    <section
      aria-label="Thread attention"
      className="flex shrink-0 flex-col gap-1"
    >
      <TasksHeading count={list.tasks.length} />
      {list.tasks.length > 0 && (
        <TooltipProvider delay={300}>
          <ul aria-label="Tasks" className="flex flex-col gap-0.5">
            {list.tasks.map((task) => (
              <BottomBarRow
                key={task._id}
                list={list}
                task={task}
                reveal={reveal}
              />
            ))}
          </ul>
        </TooltipProvider>
      )}
      <AddTaskLine list={list} />
    </section>
  );
}

export function BottomBarOnHover({ thread }: { thread: Thread }) {
  return <BottomBarTasks thread={thread} reveal="on-hover" />;
}

export function BottomBarAlways({ thread }: { thread: Thread }) {
  return <BottomBarTasks thread={thread} reveal="always" />;
}

function BottomBarRow({
  list,
  task,
  reveal,
}: {
  list: TaskList;
  task: Task;
  reveal: "on-hover" | "always";
}) {
  const row = useTaskRow(list, task);

  return (
    <li
      aria-busy={row.busy || undefined}
      className={cn(
        "group/task flex flex-col rounded-lg px-1 pt-1 pb-0.5 transition-colors motion-reduce:transition-none",
        row.focused ? "bg-brand-accent/12" : "hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <CompleteCircle row={row} />
        <div className="min-w-0 flex-1 pt-1 xl:pt-0">
          <TaskTextField
            value={task.text}
            onSave={row.edit}
            disabled={row.busy}
            className={row.focused ? "font-medium" : undefined}
          />
          <div className="flex min-h-8 items-center gap-2 xl:min-h-7">
            <div className="-ml-1 flex min-w-0 flex-1 items-center">
              {row.when !== undefined && (
                <TaskDatePicker row={row} trigger={<DateToken row={row} />} />
              )}
            </div>
            <CommandBar row={row} reveal={reveal} />
          </div>
        </div>
      </div>
      <NoteLine list={list} row={row} className="mt-0.5 mb-1 ml-9 xl:ml-7" />
    </li>
  );
}

function CommandBar({
  row,
  reveal,
}: {
  row: TaskRowState;
  reveal: "on-hover" | "always";
}) {
  const { task } = row;
  const dateLabel =
    task.date === undefined ? taskDateLabels.set : taskDateLabels.change;

  return (
    <div
      role="toolbar"
      aria-label={`Actions for “${task.text}”`}
      className={cn(
        "-mr-1 flex shrink-0 items-center gap-0.5 transition-opacity motion-reduce:transition-none",
        reveal === "on-hover" &&
          "xl:opacity-0 xl:group-focus-within/task:opacity-100 xl:group-hover/task:opacity-100 xl:has-data-popup-open:opacity-100",
      )}
    >
      {task.repeat !== undefined && (
        <Command
          label="Skip to the next date"
          disabled={row.busy}
          onClick={row.skip}
        >
          <SkipForward />
        </Command>
      )}
      <Tooltip>
        <TaskDatePicker
          row={row}
          trigger={
            <TooltipTrigger
              render={
                <CommandButton label={dateLabel} disabled={row.busy}>
                  <CalendarClock />
                </CommandButton>
              }
            />
          }
        />
        <TooltipContent>{dateLabel}</TooltipContent>
      </Tooltip>
      <Command
        label={row.focused ? "Unfocus" : "Focus"}
        pressed={row.focused}
        disabled={row.busy}
        onClick={row.toggleFocus}
        className={row.focused ? "text-brand-accent-text" : undefined}
      >
        <Target />
      </Command>
      <Command
        label="Complete with a note"
        expanded={row.noting}
        disabled={row.busy}
        onClick={row.toggleNote}
        className={row.noting ? "bg-muted text-foreground" : undefined}
      >
        <MessageSquarePlus />
      </Command>
      <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border" />
      <Command
        label="Remove"
        disabled={row.busy}
        onClick={row.remove}
        className="hover:text-destructive"
      >
        <Trash2 />
      </Command>
    </div>
  );
}

/** One icon command, named by its tooltip. */
function Command({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactElement;
  pressed?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string | undefined;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CommandButton label={label} {...props}>
            {children}
          </CommandButton>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CommandButton({
  label,
  pressed,
  expanded,
  className,
  children,
  ...props
}: {
  label: string;
  pressed?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string | undefined;
  children: ReactElement;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted data-popup-open:text-foreground motion-reduce:transition-none xl:size-7 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
