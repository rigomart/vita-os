import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { Note } from "@vita-os/contracts";
import type { ComponentType, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { useAreas, useOpenNotes, useOpenThreads } from "@vita-os/application";
import {
  buildAttentionBoard,
  groupByWhen,
  itemId,
  unscheduledRuns,
  type BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { filterDashboard } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardFilter } from "@vita-os/application/internal/dashboard/components/dashboard-filter.tsx";
import {
  groupLook,
  itemTitle,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import {
  Count,
  FileTab,
} from "@vita-os/application/internal/dashboard/components/dashboard-list.tsx";
import { dateToken } from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import { DashboardOverviewSkeleton } from "@vita-os/application/internal/dashboard/components/dashboard-overview-skeleton.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { cn } from "@vita-os/ui/lib/utils";
import { useState } from "react";

import type { NoteCardProps, ThreadCardProps } from "./parts";

/** One direction: how a Thread and a Note each look on the board. */
export interface CardSet {
  Thread: ComponentType<ThreadCardProps>;
  Note: ComponentType<NoteCardProps>;
  /** The space between cards, for directions whose cards stand apart. */
  gap?: string;
  /** What leads a far item's one-line row. */
  mark?: (kind: BoardItem["kind"]) => ReactNode;
}

/**
 * The Dashboard as it ships — filter, file tabs, No date beside — with the
 * cards swapped for a direction's. Below `lg`, No date sits under the list
 * unfolded, which the product folds; the cards are the question here.
 */
export function CardBoard({ cards }: { cards: CardSet }) {
  const currentDate = useAttentionClock();
  const filter = useDashboardFilterParams();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
  const [openNote, setOpenNote] = useState<Note | null>(null);

  if (areas === undefined || threads === undefined || notes === undefined) {
    return <DashboardOverviewSkeleton />;
  }

  const filtered = filterDashboard({ threads, notes, areas, params: filter });
  const board = buildAttentionBoard(
    filtered.threads,
    filtered.notes,
    currentDate,
  );
  const groups = groupByWhen(
    [...board.now, ...board.week, ...board.later],
    currentDate,
  );
  const runs = unscheduledRuns(board);
  const areaById = new Map(areas.map((area) => [area._id, area]));
  const mark = cards.mark ?? dotMark;

  const card = (item: BoardItem, dateInHeading: boolean, onLateFill: boolean) =>
    item.kind === "note" ? (
      <cards.Note
        currentDate={currentDate}
        dateInHeading={dateInHeading}
        note={item.note}
        onLateFill={onLateFill}
        onOpenNote={setOpenNote}
      />
    ) : (
      <cards.Thread
        area={
          item.thread.areaId === undefined
            ? undefined
            : areaById.get(item.thread.areaId)
        }
        currentDate={currentDate}
        dateInHeading={dateInHeading}
        onLateFill={onLateFill}
        thread={item.thread}
      />
    );

  return (
    <div className="mx-auto grid max-w-[76rem] gap-x-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 pb-10 lg:pb-16">
        <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-3 lg:px-3">
          <DashboardFilter options={filtered.options} />
        </div>
        <div className="@container flex flex-col gap-4 pt-2">
          {groups.map((group) => {
            const look = groupLook(group);
            return (
              <FileTab
                key={group.key}
                label={group.label}
                fill={look.fill}
                heading={
                  <>
                    <span
                      className={cn(
                        "font-heading tracking-tight",
                        look.heading,
                      )}
                    >
                      {group.label}
                    </span>
                    {group.hint && (
                      <span className="text-[13px] text-muted-foreground">
                        {group.hint}
                      </span>
                    )}
                    <Count count={group.items.length} />
                  </>
                }
              >
                <ul
                  className={cn(
                    "grid @2xl:grid-cols-2",
                    look.oneLine ? "gap-x-1" : (cards.gap ?? "gap-x-1"),
                  )}
                >
                  {group.items.map((item) => (
                    <li key={itemId(item)}>
                      {look.oneLine ? (
                        <Line
                          item={item}
                          mark={mark(item.kind)}
                          currentDate={currentDate}
                          onOpenNote={setOpenNote}
                        />
                      ) : (
                        card(item, group.exact, group.tone === "late")
                      )}
                    </li>
                  ))}
                </ul>
              </FileTab>
            );
          })}
        </div>
      </div>

      <aside
        aria-label="No date"
        className="min-w-0 pt-6 pb-24 [scrollbar-width:thin] lg:sticky lg:top-0 lg:-mr-3 lg:h-svh lg:self-start lg:overflow-y-auto lg:border-l lg:pr-3 lg:pl-8"
      >
        <h2 className="flex items-baseline gap-2">
          <span className="font-heading text-xl font-semibold tracking-tight">
            No date
          </span>
          <Count count={runs.reduce((n, run) => n + run.items.length, 0)} />
        </h2>
        <div className="flex flex-col gap-5 pt-4">
          {runs.map((run) => (
            <section key={run.key} aria-label={run.title}>
              <h3 className="flex items-baseline gap-2 pb-1 text-[13px] font-semibold text-muted-foreground">
                {run.title}
                <span className="font-normal tabular-nums opacity-70">
                  {run.items.length}
                </span>
              </h3>
              <ul className={cn("-mx-3 grid", cards.gap)}>
                {run.items.map((item) => (
                  <li key={itemId(item)}>{card(item, false, false)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>

      {openNote && (
        <StandaloneNoteDialog
          key={openNote._id}
          note={openNote}
          onOpenChange={(open) => {
            if (!open) setOpenNote(null);
          }}
        />
      )}
    </div>
  );
}

/** The shipped far-row mark: solid for a Thread, outlined for a Note. */
function dotMark(kind: BoardItem["kind"]) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 -translate-y-px rounded-full",
        kind === "note"
          ? "border border-muted-foreground"
          : "bg-muted-foreground/70",
      )}
    />
  );
}

/** A far item as one line. Threads open in the pane by the URL. */
function Line({
  currentDate,
  item,
  mark,
  onOpenNote,
}: {
  currentDate: number;
  item: BoardItem;
  mark: ReactNode;
  onOpenNote: (note: Note) => void;
}) {
  const content = (
    <>
      {mark}
      <span className="min-w-0 flex-1 truncate">{itemTitle(item)}</span>
      {item.when !== undefined && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {dateToken(item.when, currentDate)}
        </span>
      )}
    </>
  );
  const className =
    "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm text-foreground/80 transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40";
  return item.kind === "thread" ? (
    <ThreadLine slug={item.thread.slug} className={className}>
      {content}
    </ThreadLine>
  ) : (
    <button
      type="button"
      onClick={() => onOpenNote(item.note)}
      className={className}
    >
      {content}
    </button>
  );
}

function ThreadLine({
  children,
  className,
  slug,
}: {
  children: ReactNode;
  className: string;
  slug: string;
}) {
  return (
    <Link
      to="."
      search={(previous: ProductSearch): ProductSearch => ({
        ...previous,
        thread: slug,
      })}
      className={className}
    >
      {children}
    </Link>
  );
}
