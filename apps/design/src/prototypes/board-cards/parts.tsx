import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type {
  AreaSummary,
  Note,
  Repeat,
  Task,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import { Link } from "@tanstack/react-router";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
import {
  repeatLabel,
  taskDateLabels,
  timeToken,
  withTimeToken,
} from "@vita-os/application/internal/attention-list/index.ts";
import { cardTask } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import {
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  BoardTag,
  concealed,
  isLate,
  revealed,
  showsBoardDate,
} from "@vita-os/application/internal/dashboard/components/board-card.tsx";
import {
  dateToken,
  dateToneClassName,
  dayDelta,
} from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import { useArchiveNote } from "@vita-os/application/internal/notes/use-archive-note.ts";
import { useUpdateNoteWhen } from "@vita-os/application/internal/notes/use-update-note-when.ts";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "@vita-os/application/internal/threads/use-tasks.ts";
import { attentionDate } from "@vita-os/core";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import {
  Archive,
  CalendarClock,
  ListTodo,
  Repeat as RepeatIcon,
  SkipForward,
} from "lucide-react";

/**
 * The working parts of the board's cards, taken apart so each direction only
 * arranges them: the same commands, dates and rules as the shipped cards,
 * none of their layout.
 */

export interface ThreadCardProps {
  area?: AreaSummary;
  currentDate: number;
  dateInHeading: boolean;
  onLateFill: boolean;
  thread: Thread;
}

export interface NoteCardProps {
  currentDate: number;
  dateInHeading: boolean;
  note: Note;
  onLateFill: boolean;
  onOpenNote: (note: Note) => void;
}

export type ThreadCard = ReturnType<typeof useThreadCard>;
export type NoteCard = ReturnType<typeof useNoteCard>;

/** The shipped `ThreadAttentionCard`'s behaviour, as parts. */
export function useThreadCard({
  area,
  currentDate,
  dateInHeading,
  thread,
}: ThreadCardProps) {
  const completeTask = useCompleteTask(thread);
  const skipTask = useSkipTask(thread);
  const taskDates = useTaskDates(thread);
  const completingTaskIds = useCompletingTaskIds(thread);

  const tasks = thread.tasks ?? [];
  const placedBy = attentionDate(thread);
  const shown = cardTask(thread);
  const { slot, focused } = shown;
  const lead = shown.task;
  const taskDate = lead?.date;
  const action = useGuardedAsyncAction((run: () => unknown) => run(), {
    errorToast: false,
  });
  const dateAction = useGuardedAsyncAction(
    (when: number | undefined) => {
      if (lead !== undefined) return taskDates.setDate(lead._id, when ?? null);
      if (when !== undefined) return taskDates.addFollowUp(when);
    },
    { errorToast: false },
  );
  const repeatAction = useGuardedAsyncAction(
    (repeat: Repeat | null) =>
      lead === undefined ? undefined : taskDates.setRepeat(lead._id, repeat),
    { errorToast: false },
  );
  const pending =
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending ||
    (lead !== undefined && completingTaskIds.has(lead._id));
  const late = isLate(placedBy, currentDate);
  const showsDate = showsBoardDate(taskDate, dateInHeading);
  const showsPlacedDate =
    taskDate === undefined && showsBoardDate(placedBy, dateInHeading);

  return {
    late,
    /** The date reads as a token; otherwise `date` is a revealed control. */
    showsDate,
    hasTasks: tasks.length > 0,
    date: (
      <BoardDate
        busy={pending}
        currentDate={currentDate}
        inHeading={dateInHeading}
        labels={taskDateLabels}
        onSetWhen={(when) => dateAction.run(when)}
        {...(lead === undefined
          ? {}
          : {
              repeat: {
                value: lead.repeat,
                onChange: (repeat: Repeat | null) => repeatAction.run(repeat),
              },
            })}
        when={taskDate}
      />
    ),
    placedDate: showsPlacedDate ? (
      <PlacedDate
        currentDate={currentDate}
        inHeading={dateInHeading}
        when={placedBy!}
      />
    ) : null,
    tag: area ? (
      <BoardTag
        icon={<AreaIcon icon={area.icon} className="size-3 shrink-0" />}
        label={area.name}
      />
    ) : null,
    area,
    skip:
      lead !== undefined && shown.canSkip ? (
        <BoardControl
          label={`Skip “${lead.text}” to its next date`}
          disabled={pending}
          onClick={() => void action.run(() => skipTask(lead._id))}
          className={revealed}
        >
          <SkipForward className="size-3.5" />
        </BoardControl>
      ) : null,
    complete:
      lead !== undefined ? (
        <BoardCompleteButton
          label={`Complete “${lead.text}”`}
          disabled={pending}
          onClick={() => void action.run(() => completeTask(lead._id))}
        />
      ) : null,
    pips:
      tasks.length > 1 && lead !== undefined && focused ? (
        <TaskPips tasks={tasks} focusedTaskId={lead._id} />
      ) : null,
    /** The glyph before the task slot's text. */
    marker:
      lead === undefined ? (
        <ListTodo className="size-3 text-muted-foreground/60" />
      ) : shown.marker === "repeat" ? (
        <RepeatIcon
          className={cn(
            "size-3",
            focused
              ? "text-brand-accent-strong"
              : late
                ? "text-condition-attention"
                : "text-muted-foreground",
          )}
        />
      ) : (
        <TaskMarker focused={focused} />
      ),
    /** The task slot's words. */
    taskText:
      slot.kind === "sameDay" ? (
        <span className="text-muted-foreground/80">
          {slot.count} tasks{" "}
          {dayDelta(slot.date, currentDate) === 0 ? "today" : "that day"}
        </span>
      ) : lead === undefined ? (
        <span className="text-muted-foreground/80">
          {tasks.length} tasks · none focused
        </span>
      ) : (
        <span aria-busy={pending || undefined} className="text-foreground/75">
          <span className="sr-only">
            {focused ? "Focused Task" : "Task"}
            {lead.repeat === undefined
              ? ": "
              : `, ${repeatLabel(lead.repeat).toLowerCase()}: `}
          </span>
          {lead.text}
        </span>
      ),
    /** The title, stretched over the whole card so the card opens it. */
    title: (className?: string) => (
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: thread.slug,
        })}
        className={cn(
          "line-clamp-2 min-w-0 text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
      >
        {thread.title}
      </Link>
    ),
  };
}

/** The shipped `DashboardNote`'s behaviour, as parts. */
export function useNoteCard({
  currentDate,
  dateInHeading,
  note,
  onOpenNote,
}: NoteCardProps) {
  const archiveNote = useArchiveNote();
  const archive = useGuardedAsyncAction(() => archiveNote(note._id), {
    successMessage: "Note archived",
  });
  const updateNoteWhen = useUpdateNoteWhen();
  const when = note.followUp ?? undefined;
  const text = markdownToPlainText(note.body);

  return {
    late: isLate(when, currentDate),
    showsDate: showsBoardDate(when, dateInHeading),
    date: (
      <BoardDate
        currentDate={currentDate}
        inHeading={dateInHeading}
        onSetWhen={(next) => void updateNoteWhen(note._id, next)}
        when={when}
      />
    ),
    archive: (
      <BoardCompleteButton
        icon={Archive}
        label="Archive note"
        onClick={() => void archive.run()}
      />
    ),
    /** The body, stretched over the whole card so the card opens the Note. */
    body: (className?: string) => (
      <button
        type="button"
        aria-label={`Open note: ${text.slice(0, 120)}`}
        onClick={() => onOpenNote(note)}
        className={cn(
          "line-clamp-2 min-h-0 rounded-sm py-0 text-left text-sm leading-snug whitespace-pre-line wrap-anywhere text-foreground/85 outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:ring-3 focus-visible:ring-ring/30",
          className,
        )}
      >
        {text}
      </button>
    ),
  };
}

/** The footer's type, as the shipped cards set it. */
export const footerText =
  "flex min-h-6 items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75";

/**
 * The right of a Thread's footer: the pips at rest, handing their place to
 * the controls on hover.
 */
export function ThreadControls({
  card,
  withDate = false,
}: {
  card: ThreadCard;
  /** Keep the date token here too, rather than at the left. */
  withDate?: boolean;
}) {
  return (
    <span className="ml-auto grid shrink-0 justify-items-end pl-1 *:col-start-1 *:row-start-1">
      {card.pips && (
        <span className={cn("self-center", concealed)}>{card.pips}</span>
      )}
      <span className="flex items-center gap-1.5">
        {(withDate || !card.showsDate) && card.date}
        {card.skip}
        {card.complete}
      </span>
    </span>
  );
}

export function NoteControls({
  card,
  withDate = false,
}: {
  card: NoteCard;
  withDate?: boolean;
}) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
      {(withDate || !card.showsDate) && card.date}
      {card.archive}
    </span>
  );
}

/** The date that placed a Thread whose card shows no single Task. */
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

const MAX_PIPS = 6;

function TaskPips({
  focusedTaskId,
  tasks,
}: {
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
      className="inline-flex items-center gap-[3px]"
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
