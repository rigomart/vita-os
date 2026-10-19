import type { Note, Repeat, Task, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { Archive, SkipForward } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";
import type { BoardItem } from "./attention-board-model";
import type { BoardScope } from "./dashboard-item";
import type { LineLook } from "./dashboard-list-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { taskDateLabels } from "../../attention-list";
import { useArchiveNote } from "../../notes/use-archive-note";
import {
  completeNoteFailure,
  completeNoteLabel,
  useCompleteNote,
} from "../../notes/use-complete-note";
import { useSetNoteRepeat } from "../../notes/use-set-note-repeat";
import { useUpdateNoteWhen } from "../../notes/use-update-note-when";
import {
  TaskMarker,
  TaskText,
} from "../../threads/components/thread-attention-card";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "../../threads/use-tasks";
import {
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  revealed,
  showsBoardDate,
} from "./board-card";
import { itemTitle } from "./dashboard-list-model";
import { ThreadCopy } from "./thread-copies";

/**
 * One dated item on the Dashboard's list, as a line: a marker, the words, then
 * the Area and the date at the right, with Skip, the date and Complete
 * revealed on hover or focus. `look` sizes and inks it by how near its group
 * is. The whole line opens the Thread or the Note.
 *
 * A Thread's copy reads its Task, then the Thread's title, muted; on a narrow
 * list the title drops under the Task. Every control acts on the Task that
 * placed the copy and no other.
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
  const action = useGuardedAsyncAction((run: () => unknown) => run(), {
    errorToast: false,
  });
  const dateAction = useGuardedAsyncAction(
    (when: number | undefined) =>
      task === undefined
        ? undefined
        : taskDates.setDate(task._id, when ?? null),
    { errorToast: false },
  );
  const repeatAction = useGuardedAsyncAction(
    (repeat: Repeat | null) =>
      task === undefined ? undefined : taskDates.setRepeat(task._id, repeat),
    { errorToast: false },
  );
  const busy =
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending ||
    (task !== undefined && completing.has(task._id));
  const area =
    thread.areaId === undefined ? undefined : scope.areaById.get(thread.areaId);

  return (
    <LineFrame
      busy={busy}
      look={look}
      marker={
        task === undefined ? undefined : (
          <TaskMarker task={task} currentDate={scope.currentDate} />
        )
      }
      words={
        <p className="@md:truncate">
          {task !== undefined && (
            <span className={cn("line-clamp-2 @md:inline", look.task)}>
              <TaskText task={task} />
            </span>
          )}
          <span
            className={cn(
              task === undefined
                ? cn("line-clamp-2 @md:inline", look.task)
                : cn(
                    "block truncate text-muted-foreground @md:inline",
                    look.thread,
                  ),
            )}
          >
            {task !== undefined && (
              <span aria-hidden className="hidden @md:inline">
                {" · "}
              </span>
            )}
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
          </span>
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
      showsDate={showsBoardDate(task?.date, dateInHeading)}
      date={
        <BoardDate
          busy={busy}
          currentDate={scope.currentDate}
          inHeading={dateInHeading}
          labels={taskDateLabels}
          onSetWhen={(when) => dateAction.run(when)}
          {...(task === undefined
            ? {}
            : {
                repeat: {
                  value: task.repeat,
                  onChange: (repeat: Repeat | null) => repeatAction.run(repeat),
                },
              })}
          when={task?.date}
        />
      }
      controls={
        task !== undefined && (
          <>
            {task.repeat !== undefined && (
              <BoardControl
                label={`Skip “${task.text}” to its next date`}
                disabled={busy}
                onClick={() => void action.run(() => skipTask(task._id))}
                className={revealed}
              >
                <SkipForward className="size-3.5" />
              </BoardControl>
            )}
            <BoardCompleteButton
              label={`Complete “${task.text}”`}
              disabled={busy}
              onClick={() => void action.run(() => completeTask(task._id))}
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
        "group/card relative flex items-start gap-2.5 rounded-lg px-2.5 transition-colors has-focus-visible:bg-muted/60 hover:bg-muted/50",
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
