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
import {
  Archive,
  ListTodo,
  Repeat as RepeatIcon,
  SkipForward,
} from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";
import type { BoardItem } from "./attention-board-model";
import type { LineLook } from "./dashboard-list-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { repeatLabel, taskDateLabels } from "../../attention-list";
import { useArchiveNote } from "../../notes/use-archive-note";
import {
  completeNoteFailure,
  completeNoteLabel,
  useCompleteNote,
} from "../../notes/use-complete-note";
import { useSetNoteRepeat } from "../../notes/use-set-note-repeat";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "../../threads/use-tasks";
import { lineTask } from "./attention-board-model";
import { itemTitle } from "./dashboard-list-model";
import {
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  focusRing,
  isLate,
  revealed,
  showsBoardDate,
} from "./line-controls";
import { ThreadCopy } from "./thread-copies";

export interface BoardScope {
  areaById: ReadonlyMap<string, AreaSummary>;
  currentDate: number;
  onOpenNote: (note: Note) => void;
}

/**
 * One item on the Dashboard, as a line: a marker, the words, then the Area
 * and the date at the right, with Skip, the date and Complete revealed on
 * hover or focus. `look` sizes and inks it by how near its group is. The
 * whole line opens the Thread or the Note.
 *
 * On the list a Thread's copy reads its Task, then the Thread's title, muted;
 * on a narrow list the title drops under the Task. In No date the Thread's
 * title leads, over its only Task or how many it has, because the line must
 * not invent a headline the person never chose. Every control acts on the
 * Task the line names (`lineTask`) and no other; a No date line naming no
 * single Task offers no Complete, and a date set there adds a Task named
 * "Follow up" with it.
 */
export function DashboardLine({
  dateInHeading,
  item,
  look,
  scope,
}: {
  /** The group's heading names this item's day, so only a time is shown. */
  dateInHeading: boolean;
  item: BoardItem;
  look: LineLook;
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
    <ThreadCopy thread={item.thread} className="rounded-lg">
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
  look: LineLook;
  scope: BoardScope;
  task?: Task;
  thread: Thread;
}) {
  const completeTask = useCompleteTask(thread);
  const skipTask = useSkipTask(thread);
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
  const title = (
    <Link
      to="."
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        thread: thread.slug,
      })}
      className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
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
    <LineFrame
      busy={busy}
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
        <p className="@md:truncate">
          <span className={cn("line-clamp-2 @md:inline", look.task)}>
            {first}
          </span>
          {second && (
            <span
              className={cn(
                "block truncate text-muted-foreground @md:inline",
                look.thread,
              )}
            >
              <span aria-hidden className="hidden @md:inline">
                {" · "}
              </span>
              {second}
            </span>
          )}
        </p>
      }
      meta={
        area && (
          <span
            title={area.name}
            className="hidden items-center gap-1 text-muted-foreground/80 @md:inline-flex"
          >
            <AreaIcon icon={area.icon} className="size-3 shrink-0" />
            <span className="max-w-28 truncate">{area.name}</span>
          </span>
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
          <>
            {lead.repeat !== undefined && (
              <BoardControl
                label={`Skip “${lead.text}” to its next date`}
                disabled={busy}
                onClick={() => void action.run(() => skipTask(lead._id))}
                className={revealed}
              >
                <SkipForward className="size-3.5" />
              </BoardControl>
            )}
            <BoardCompleteButton
              label={`Complete “${lead.text}”`}
              disabled={busy}
              onClick={() => void action.run(() => completeTask(lead._id))}
            />
          </>
        )
      }
    />
  );
}

/**
 * A dated Standalone Note as a line, marked by a small dog-eared sheet. A
 * repeating Note wears the repeat glyph on its date under any heading and
 * offers Complete; a one-off Note offers Archive.
 */
function NoteLine({
  dateInHeading,
  look,
  note,
  scope,
}: {
  dateInHeading: boolean;
  look: LineLook;
  note: Note;
  scope: BoardScope;
}) {
  const archiveNote = useArchiveNote();
  // The line leaves at once; the toast says where the Note went.
  const archive = useGuardedAsyncAction(() => archiveNote(note._id), {
    successMessage: "Note archived",
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
    <LineFrame
      busy={busy}
      look={look}
      marker={
        <span className="block h-2.5 w-2 rounded-[1.5px] border border-muted-foreground/60 [clip-path:polygon(0_0,55%_0,100%_40%,100%_100%,0_100%)]" />
      }
      words={
        <button
          type="button"
          aria-label={`Open note: ${markdownToPlainText(note.body).slice(0, 120)}`}
          onClick={() => scope.onOpenNote(note)}
          className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-lg @md:line-clamp-1"
        >
          {itemTitle({ kind: "note", note })}
        </button>
      }
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
            icon={Archive}
            label="Archive note"
            onClick={() => void archive.run()}
          />
        )
      }
    />
  );
}

/**
 * The line's shape: marker, words, then Area, date and controls at the
 * right. The controls hold their place at rest, so nothing reflows on hover.
 */
function LineFrame({
  busy,
  controls,
  date,
  look,
  marker,
  meta,
  showsDate,
  words,
}: {
  busy: boolean;
  controls: ReactNode;
  date: ReactNode;
  look: LineLook;
  marker?: ReactNode;
  meta?: ReactNode;
  showsDate: boolean;
  words: ReactNode;
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "group/card relative flex items-start gap-2.5 rounded-lg px-2.5 transition-colors hover:bg-muted/50",
        focusRing,
        "has-focus-visible:bg-muted/60",
        look.frame,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex w-3 shrink-0 items-center justify-center",
          look.marker,
        )}
      >
        {marker}
      </span>
      <div className="min-w-0 flex-1 leading-snug">{words}</div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2.5 text-[12px] text-muted-foreground",
          look.meta,
        )}
      >
        {meta}
        {showsDate && date}
        <span className="flex items-center gap-1">
          {!showsDate && date}
          {controls}
        </span>
      </div>
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
