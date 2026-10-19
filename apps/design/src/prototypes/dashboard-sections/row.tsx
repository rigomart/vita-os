import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-item.tsx";
import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { Note, Repeat, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
import { taskDateLabels } from "@vita-os/application/internal/attention-list/index.ts";
import {
  cardTask,
  type BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import {
  BoardCompleteButton,
  BoardControl,
  BoardDate,
  isLate,
  revealed,
  showsBoardDate,
} from "@vita-os/application/internal/dashboard/components/board-card.tsx";
import { itemTitle } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { ThreadCopy } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { useArchiveNote } from "@vita-os/application/internal/notes/use-archive-note.ts";
import {
  completeNoteFailure,
  completeNoteLabel,
  useCompleteNote,
} from "@vita-os/application/internal/notes/use-complete-note.ts";
import { useSetNoteRepeat } from "@vita-os/application/internal/notes/use-set-note-repeat.ts";
import { useUpdateNoteWhen } from "@vita-os/application/internal/notes/use-update-note-when.ts";
import {
  useCompleteTask,
  useCompletingTaskIds,
  useSkipTask,
  useTaskDates,
} from "@vita-os/application/internal/threads/use-tasks.ts";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { Archive, Repeat as RepeatIcon, SkipForward } from "lucide-react";

export interface RowProps {
  item: BoardItem;
  scope: BoardScope;
  /** The heading names this item's day, so only a time is shown. */
  dateInHeading?: boolean;
  /** Muted words, for groups only there to be known about. */
  quiet?: boolean;
  /** Bigger type, for what is asking now. */
  loud?: boolean;
}

/**
 * One item on the board as a line rather than a sheet: a marker, the words,
 * then where and when, with Skip, the date and Complete revealed on hover or
 * focus, as on the cards. The whole line opens the Thread or the Note.
 *
 * A Thread's copy reads its Task, then the Thread's title, muted. Below
 * `@md` the title drops under the Task.
 */
export function ItemRow(props: RowProps) {
  return props.item.kind === "note" ? (
    <NoteRow {...props} note={props.item.note} />
  ) : (
    <ThreadCopy thread={props.item.thread} className="rounded-lg">
      <ThreadRow {...props} thread={props.item.thread} />
    </ThreadCopy>
  );
}

function ThreadRow({
  dateInHeading = false,
  item,
  loud,
  quiet,
  scope,
  thread,
}: RowProps & { thread: Thread }) {
  const task = item.kind === "thread" ? item.task : undefined;
  const lead = cardTask(thread, task);
  const completeTask = useCompleteTask(thread);
  const skipTask = useSkipTask(thread);
  const taskDates = useTaskDates(thread);
  const completing = useCompletingTaskIds(thread);
  const action = useGuardedAsyncAction((run: () => unknown) => run());
  const dateAction = useGuardedAsyncAction((when: number | undefined) =>
    lead === undefined
      ? when === undefined
        ? undefined
        : taskDates.addFollowUp(when)
      : taskDates.setDate(lead._id, when ?? null),
  );
  const repeatAction = useGuardedAsyncAction((repeat: Repeat | null) =>
    lead === undefined ? undefined : taskDates.setRepeat(lead._id, repeat),
  );
  const busy =
    action.isPending ||
    dateAction.isPending ||
    repeatAction.isPending ||
    (lead !== undefined && completing.has(lead._id));
  const area =
    thread.areaId === undefined ? undefined : scope.areaById.get(thread.areaId);
  const late = isLate(lead?.date, scope.currentDate);

  return (
    <RowFrame
      busy={busy}
      quiet={quiet}
      loud={loud}
      marker={
        lead?.repeat !== undefined ? (
          <RepeatIcon
            className={cn(
              "size-3",
              late ? "text-condition-attention" : "text-muted-foreground",
            )}
          />
        ) : (
          <span className="size-2 rounded-full border border-muted-foreground/60" />
        )
      }
      words={
        <Link
          to="."
          search={(previous: ProductSearch): ProductSearch => ({
            ...previous,
            thread: thread.slug,
          })}
          className="block outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] @md:truncate"
        >
          <span
            className={cn("line-clamp-2 @md:inline", !quiet && "font-medium")}
          >
            {task?.text ?? thread.title}
          </span>
          {task !== undefined && (
            <span className="block truncate text-[13px] font-normal text-muted-foreground @md:inline">
              <span className="hidden @md:inline"> · </span>
              {thread.title}
            </span>
          )}
        </Link>
      }
      meta={
        area && (
          <span
            title={area.name}
            className="hidden items-center gap-1 text-[12px] text-muted-foreground/80 @md:inline-flex"
          >
            <AreaIcon icon={area.icon} className="size-3 shrink-0" />
            <span className="max-w-28 truncate">{area.name}</span>
          </span>
        )
      }
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
      showsDate={showsBoardDate(lead?.date, dateInHeading)}
      controls={
        <>
          {lead?.repeat !== undefined && (
            <BoardControl
              label={`Skip “${lead.text}” to its next date`}
              disabled={busy}
              onClick={() => void action.run(() => skipTask(lead._id))}
              className={revealed}
            >
              <SkipForward className="size-3.5" />
            </BoardControl>
          )}
          {lead !== undefined && (
            <BoardCompleteButton
              label={`Complete “${lead.text}”`}
              disabled={busy}
              onClick={() => void action.run(() => completeTask(lead._id))}
            />
          )}
        </>
      }
    />
  );
}

function NoteRow({
  dateInHeading = false,
  loud,
  note,
  quiet,
  scope,
}: RowProps & { note: Note }) {
  const archiveNote = useArchiveNote();
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
  const body = markdownToPlainText(note.body);

  return (
    <RowFrame
      busy={busy}
      quiet={quiet}
      loud={loud}
      marker={<NoteMark />}
      words={
        <button
          type="button"
          aria-label={`Open note: ${body.slice(0, 120)}`}
          onClick={() => scope.onOpenNote(note)}
          className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-lg @md:line-clamp-1"
        >
          {itemTitle({ kind: "note", note })}
        </button>
      }
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
      showsDate={repeats || showsBoardDate(when, dateInHeading)}
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

/** A Note's mark on a line: a small sheet with its corner folded. */
export function NoteMark() {
  return (
    <span className="relative block h-2.5 w-2 rounded-[1.5px] border border-muted-foreground/60 [clip-path:polygon(0_0,55%_0,100%_40%,100%_100%,0_100%)]" />
  );
}

/**
 * The line's shape: marker, words, then Area, date and controls at the
 * right. The controls stay in place at rest so nothing reflows on hover.
 */
function RowFrame({
  busy,
  controls,
  date,
  loud,
  marker,
  meta,
  quiet,
  showsDate,
  words,
}: {
  busy: boolean;
  controls: ReactNode;
  date: ReactNode;
  loud?: boolean;
  marker: ReactNode;
  meta?: ReactNode;
  quiet?: boolean;
  showsDate: boolean;
  words: ReactNode;
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        "group/card relative flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors has-focus-visible:bg-muted/60 hover:bg-muted/50",
        loud ? "text-[15px]" : "text-sm",
        quiet ? "text-foreground/70" : "text-foreground",
        busy && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex w-3 shrink-0 items-center justify-center",
          loud ? "h-[1.4rem]" : "h-5",
        )}
      >
        {marker}
      </span>
      <div className="min-w-0 flex-1 leading-snug">{words}</div>
      <div className="flex h-5 shrink-0 items-center gap-2.5 text-[12px] text-muted-foreground">
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
