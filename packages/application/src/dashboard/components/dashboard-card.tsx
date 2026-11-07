import type {
  AreaSummary,
  Note,
  Repeat,
  Task,
  Thread,
} from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { ListTodo, Repeat as RepeatIcon } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";
import type { BoardItem } from "./attention-board-model";
import type { CardLook } from "./dashboard-list-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { repeatLabel, taskDateLabels } from "../../attention-list";
import { NoteMarker } from "../../notes/note-marker";
import {
  completeNoteFailure,
  completeNoteLabel,
  useCompleteNote,
} from "../../notes/use-complete-note";
import { useMarkNoteDone } from "../../notes/use-mark-note-done";
import { useSetNoteRepeat } from "../../notes/use-set-note-repeat";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useTaskDates,
} from "../../threads/use-tasks";
import { lineTask } from "./attention-board-model";
import { itemTitle } from "./dashboard-list-model";
import {
  BoardCompleteButton,
  BoardDate,
  focusRing,
  isLate,
  showsBoardDate,
} from "./line-controls";
import { ThreadCopy } from "./thread-copies";

export interface BoardScope {
  areaById: ReadonlyMap<string, AreaSummary>;
  currentDate: number;
  onOpenNote: (note: Note) => void;
}

/**
 * One item on the Dashboard, as a card. `look` sizes and inks it by how near
 * its group is. The whole card opens the Thread or the Note.
 *
 * On the list a Thread's copy reads its Task, then the Thread's title on its
 * own muted line. In No date the Thread's title leads, then its only Task or
 * how many it has, because the card must not invent a headline the person
 * never chose. Every control acts on the Task the card names (`lineTask`) and
 * no other; a No date card naming no single Task offers no Complete, and a
 * date set there adds a Task named "Follow up" with it.
 */
export function DashboardCard({
  dateInHeading,
  item,
  look,
  scope,
}: {
  /** The group's heading names this item's day, so only a time is shown. */
  dateInHeading: boolean;
  item: BoardItem;
  look: CardLook;
  scope: BoardScope;
}) {
  if (item.kind === "note") {
    return (
      <NoteLine
        dateInHeading={dateInHeading}
        look={look}
        note={item.note}
        scope={scope}
      />
    );
  }
  return (
    <ThreadCopy thread={item.thread} className="h-full rounded-xl">
      <ThreadLine
        dateInHeading={dateInHeading}
        look={look}
        scope={scope}
        task={item.task}
        thread={item.thread}
      />
    </ThreadCopy>
  );
}

function ThreadLine({
  dateInHeading,
  look,
  scope,
  task,
  thread,
}: {
  dateInHeading: boolean;
  look: CardLook;
  scope: BoardScope;
  task?: Task;
  thread: Thread;
}) {
  const completeTask = useCompleteTask(thread);
  const taskDates = useTaskDates(thread);
  const completing = useCompletingTaskIds(thread);
  const tasks = thread.tasks ?? [];
  const lead = lineTask(thread, task);
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
  const busy =
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending ||
    (lead !== undefined && completing.has(lead._id));
  const area =
    thread.areaId === undefined ? undefined : scope.areaById.get(thread.areaId);
  const hasAreas = scope.areaById.size > 0;
  const title = (
    <Link
      to="."
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        thread: thread.slug,
      })}
      className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
    >
      {thread.title}
    </Link>
  );
  const first = task === undefined ? title : <TaskText task={task} />;
  const second =
    task !== undefined ? (
      title
    ) : lead !== undefined ? (
      <TaskText task={lead} />
    ) : (
      tasks.length > 0 && `${tasks.length} tasks`
    );

  return (
    <CardFrame
      busy={busy}
      late={isLate(lead?.date, scope.currentDate)}
      look={look}
      marker={
        lead === undefined ? (
          tasks.length > 0 && (
            <ListTodo className="size-3 text-muted-foreground/60" />
          )
        ) : (
          <TaskMarker task={lead} currentDate={scope.currentDate} />
        )
      }
      words={
        <>
          <p className={cn("line-clamp-2", look.task)}>{first}</p>
          {second && (
            <p
              className={cn(
                "truncate pt-0.5 text-muted-foreground",
                look.detail,
              )}
            >
              {second}
            </p>
          )}
        </>
      }
      detail={
        area ? (
          <span title={area.name} className="flex min-w-0 items-center gap-1">
            <AreaIcon icon={area.icon} className="size-3 shrink-0" />
            <span className="truncate">{area.name}</span>
          </span>
        ) : (
          hasAreas && <span className="text-muted-foreground/60">No area</span>
        )
      }
      showsDate={showsBoardDate(lead?.date, dateInHeading)}
      date={
        <BoardDate
          busy={busy}
          currentDate={scope.currentDate}
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
          when={lead?.date}
        />
      }
      controls={
        lead !== undefined && (
          <BoardCompleteButton
            label={`Complete “${lead.text}”`}
            disabled={busy}
            onClick={() => void action.run(() => completeTask(lead._id))}
          />
        )
      }
    />
  );
}

/**
 * A repeating Note wears the repeat glyph on its date under any heading.
 * Complete moves a repeating Note to its next date and sends a one-off Note
 * to History.
 */
function NoteLine({
  dateInHeading,
  look,
  note,
  scope,
}: {
  dateInHeading: boolean;
  look: CardLook;
  note: Note;
  scope: BoardScope;
}) {
  const markNoteDone = useMarkNoteDone();
  // The line leaves at once; the toast says where the Note went.
  const finish = useGuardedAsyncAction(() => markNoteDone(note._id), {
    successMessage: "Note completed",
  });
  const completeNote = useCompleteNote();
  const complete = useGuardedAsyncAction(() => completeNote(note), {
    getErrorMessage: completeNoteFailure,
  });
  const updateNoteWhen = useUpdateNoteWhen();
  const setNoteRepeat = useSetNoteRepeat();
  const dateAction = useGuardedAsyncAction((when: number | undefined) =>
    updateNoteWhen(note._id, when),
  );
  const repeatAction = useGuardedAsyncAction((repeat: Repeat | null) =>
    setNoteRepeat(note._id, repeat),
  );
  const busy =
    complete.isPending || dateAction.isPending || repeatAction.isPending;
  const when = note.followUp ?? undefined;
  const repeats = when !== undefined && note.repeat !== undefined;

  return (
    <CardFrame
      busy={busy}
      late={isLate(when, scope.currentDate)}
      look={look}
      marker={<NoteMarker />}
      words={
        <button
          type="button"
          aria-label={`Open note: ${markdownToPlainText(note.body).slice(0, 120)}`}
          onClick={() => scope.onOpenNote(note)}
          className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          {itemTitle({ kind: "note", note })}
        </button>
      }
      detail="Note"
      showsDate={repeats || showsBoardDate(when, dateInHeading)}
      date={
        <BoardDate
          busy={busy}
          currentDate={scope.currentDate}
          inHeading={dateInHeading}
          onSetWhen={(next) => dateAction.run(next)}
          repeat={{
            value: note.repeat,
            onChange: (repeat) => repeatAction.run(repeat),
          }}
          showsRepeat
          when={when}
        />
      }
      controls={
        repeats ? (
          <BoardCompleteButton
            label={completeNoteLabel(note, scope.currentDate)}
            disabled={busy}
            onClick={() => void complete.run()}
          />
        ) : (
          <BoardCompleteButton
            label="Complete note"
            onClick={() => void finish.run()}
          />
        )
      }
    />
  );
}

function CardFrame({
  busy,
  controls,
  date,
  detail,
  late,
  look,
  marker,
  showsDate,
  words,
}: {
  busy: boolean;
  controls: ReactNode;
  date: ReactNode;
  detail?: ReactNode;
  late: boolean;
  look: CardLook;
  marker?: ReactNode;
  showsDate: boolean;
  words: ReactNode;
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "group/card relative grid h-full grid-cols-[0.75rem_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-2.5 gap-y-0.5 rounded-xl px-3 leading-snug transition-colors",
        late
          ? "bg-[color-mix(in_oklab,var(--condition-attention)_8%,var(--color-surface-2))] ring-1 ring-condition-attention/25 ring-inset hover:bg-[color-mix(in_oklab,var(--condition-attention)_12%,var(--color-surface-2))]"
          : "bg-surface-2 hover:bg-surface-3",
        focusRing,
        look.frame,
      )}
    >
      <span aria-hidden className="flex h-lh items-center justify-center">
        {marker}
      </span>
      <div className="min-w-0 pr-7">{words}</div>
      <div
        className={cn(
          "col-start-2 flex min-h-5 items-center gap-2.5 self-end pt-1 text-muted-foreground",
          look.detail,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center">{detail}</span>
        {/* The date keeps its place in the tree as it turns from a control
            into a token, as a time set from its open picker does: moved, it
            would be a new picker, closed. */}
        <span
          className={cn(
            "flex shrink-0 items-center",
            showsDate ? "gap-2.5" : "gap-1",
          )}
        >
          {date}
        </span>
      </div>
      <span className="absolute top-2 right-2 flex items-center gap-1">
        {controls}
      </span>
    </div>
  );
}

function TaskText({ task }: { task: Task }) {
  return (
    <>
      <span className="sr-only">
        {task.repeat === undefined
          ? "Task: "
          : `Task, ${repeatLabel(task.repeat).toLowerCase()}: `}
      </span>
      {task.text}
    </>
  );
}

function TaskMarker({
  currentDate,
  task,
}: {
  currentDate: number;
  task: Task;
}) {
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
