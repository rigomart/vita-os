import type { AreaSummary, Note } from "@vita-os/contracts";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type {
  AttentionBoard,
  BoardGroup,
  BoardItem,
} from "./attention-board-model";

import { useIsMobile } from "../../hooks/use-mobile";
import { StandaloneNoteDialog } from "../../notes/note-view/standalone-note-dialog";
import { ConnectedThreadAttentionCard } from "../../threads/components/thread-attention-card";
import { groupByWhen, itemId, unscheduledCount } from "./attention-board-model";
import { dateToken } from "./dashboard-model";
import { DashboardNote } from "./dashboard-note";

/**
 * The lanes sit side by side only at `xl`, where the board owns the viewport's
 * height and each lane scrolls. Below it they stack and the page scrolls, and
 * on a phone the No date tray starts folded.
 *
 * Later starts folded at every size: what it holds is already scheduled, and
 * each item walks into This week on its own once it is six days out. Folded,
 * it is a narrow rail at `xl` and a single ruled heading below it, both
 * stating how many items wait there and when the next one arrives.
 */
export function DashboardBoard({
  areas,
  board,
  currentDate,
  emptyState,
}: {
  areas: AreaSummary[];
  board: AttentionBoard;
  currentDate: number;
  /** Keep the Note view mounted even when its last open card leaves. */
  emptyState?: ReactNode;
}) {
  const areaById = new Map(areas.map((area) => [area._id, area]));
  const isMobile = useIsMobile();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: "Late or due today",
      urgent: true,
      items: board.now,
    },
    {
      key: "week",
      title: "This week",
      hint: "The next six days",
      items: board.week,
    },
    {
      key: "later",
      title: "Later",
      hint: "Dated beyond this week",
      items: board.later,
    },
  ];

  const runs = [
    { key: "moves", title: "Ready to move", items: board.unscheduled.moves },
    { key: "open", title: "Open", items: board.unscheduled.open },
    { key: "notes", title: "Notes", items: board.unscheduled.notes },
  ].filter((run) => run.items.length > 0);

  const nextLater = board.later[0]?.when;

  const renderItem = (
    item: BoardItem,
    { dateInHeading = false, onTray = false } = {},
  ) =>
    item.kind === "note" ? (
      <DashboardNote
        currentDate={currentDate}
        dateInHeading={dateInHeading}
        note={item.note}
        onTray={onTray}
        onOpenNote={setSelectedNote}
      />
    ) : (
      <ConnectedThreadAttentionCard
        area={
          item.thread.areaId === undefined
            ? undefined
            : areaById.get(item.thread.areaId)
        }
        currentDate={currentDate}
        dateInHeading={dateInHeading}
        onTray={onTray}
        thread={item.thread}
      />
    );

  return (
    // No date is a peer of the dated lanes and a little wider, because its
    // cards carry as much as theirs do. While Later is a rail, This week takes
    // the width it gives up, since that is where days need the room.
    <>
      {emptyState ?? (
        <div
          className={cn(
            "grid gap-6 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:gap-6",
            laterOpen
              ? "xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.25fr)]"
              : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto_minmax(0,1.25fr)]",
          )}
        >
          {columns.map((column) => {
            const later = column.key === "later";
            return (
              <BoardLane
                key={column.key}
                // Below `xl` a folded Later is one heading; it spans the row
                // rather than leave a hole beside the tray.
                className={cn(later && "md:col-span-2 xl:col-span-1")}
                count={column.items.length}
                hint={column.hint}
                title={column.title}
                tone={column.urgent ? "urgent" : "default"}
                fold={
                  later
                    ? {
                        open: laterOpen,
                        onOpenChange: setLaterOpen,
                        rail: true,
                        next:
                          nextLater === undefined
                            ? undefined
                            : dateToken(nextLater, currentDate),
                      }
                    : undefined
                }
              >
                <div className="-mx-1 flex flex-col gap-3 px-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                  {groupByWhen(column.items, currentDate).map((group) => (
                    <section key={group.key} aria-label={group.label}>
                      <RunHeading
                        className={cn(
                          groupTones[group.tone],
                          "xl:sticky xl:top-0 xl:z-20 xl:bg-surface-1",
                        )}
                        count={group.items.length}
                        hint={group.hint}
                        title={group.label}
                      />
                      <ul className="flex flex-col gap-1.5">
                        {group.items.map((item) => (
                          <li key={itemId(item)}>
                            {renderItem(item, { dateInHeading: group.exact })}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {column.items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground/60">
                      Nothing here.
                    </p>
                  )}
                </div>
              </BoardLane>
            );
          })}

          {/* A tray, not a fourth stretch of the calendar: recessed, unruled. */}
          <BoardLane
            className="rounded-3xl bg-muted/50 p-3 pb-1 md:col-span-2 xl:col-span-1 xl:p-4 xl:pb-2"
            count={unscheduledCount(board)}
            element="aside"
            hint="Not on the calendar"
            title="No date"
            tone="tray"
            fold={isMobile ? {} : undefined}
          >
            <div className="-mx-1 flex flex-col gap-4 px-1 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              {runs.map((run) => (
                <section key={run.key} aria-label={run.title}>
                  <RunHeading
                    className="text-foreground/70"
                    count={run.items.length}
                    title={run.title}
                  />
                  <ul className="flex flex-col gap-1.5">
                    {run.items.map((item) => (
                      <li key={itemId(item)}>
                        {renderItem(item, { onTray: true })}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {runs.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground/60">
                  Nothing unscheduled.
                </p>
              )}
            </div>
          </BoardLane>
        </div>
      )}
      {selectedNote && (
        <StandaloneNoteDialog
          key={selectedNote._id}
          note={selectedNote}
          onOpenChange={(open) => {
            if (!open) setSelectedNote(null);
          }}
        />
      )}
    </>
  );
}

/** Nearer reads louder; late alarms, as its cards' dates do. */
const groupTones: Record<BoardGroup["tone"], string> = {
  late: "text-condition-attention",
  today: "text-foreground",
  near: "text-foreground/85",
  soon: "text-foreground/70",
  week: "text-foreground/55",
  far: "text-muted-foreground",
};

/**
 * The heading over one run of cards, in a lane or on the tray: what the run
 * is, how many it holds, and a quiet hint flush right.
 */
function RunHeading({
  className,
  count,
  hint,
  title,
}: {
  className?: string;
  count: number;
  hint?: string;
  title: string;
}) {
  return (
    <h3
      className={cn(
        "flex items-baseline gap-1.5 px-3 pb-1.5 text-xs font-medium",
        className,
      )}
    >
      {title}
      <span className="tabular-nums text-muted-foreground/60">{count}</span>
      {hint && (
        <span className="ml-auto truncate pl-2 text-[11px] font-normal text-muted-foreground/60">
          {hint}
        </span>
      )}
    </h3>
  );
}

const tones = {
  urgent: {
    border: "border-condition-attention/50",
    title: "text-condition-attention",
  },
  default: { border: "border-border/70", title: "text-foreground/80" },
  tray: { border: "border-transparent", title: "text-foreground/80" },
};

/**
 * How a lane folds. Without `open`, it keeps its own state and starts folded.
 * A `rail` lane folds at `xl` into a narrow rail rather than a heading over
 * nothing, and says when its soonest item, `next`, arrives.
 */
interface LaneFold {
  next?: string | undefined;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  rail?: boolean;
}

/**
 * One lane: a ruled heading — title, count, and what the lane holds — and its
 * cards under it.
 */
function BoardLane({
  children,
  className,
  count,
  element = "section",
  fold,
  hint,
  title,
  tone,
}: {
  children: ReactNode;
  className?: string;
  count: number;
  element?: "aside" | "section";
  fold?: LaneFold | undefined;
  hint?: string;
  title: string;
  tone: keyof typeof tones;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = fold?.open ?? ownOpen;
  const setOpen = fold?.onOpenChange ?? setOwnOpen;

  // A folded lane can't show its cards arrive, so its count marks each one.
  const [seenCount, setSeenCount] = useState(count);
  const [arrivals, setArrivals] = useState(0);
  if (count !== seenCount) {
    setSeenCount(count);
    if (fold && !open && count > seenCount) setArrivals((n) => n + 1);
  }

  const Element = element;
  const { border, title: titleClass } = tones[tone];
  const railed = fold?.rail === true && !open;

  const titleText = (
    <span className={cn("text-sm font-medium", titleClass)}>{title}</span>
  );
  // Colour only when urgent and non-empty: the one number worth alarming.
  const countText = (
    <span
      key={arrivals}
      className={cn(
        "text-sm tabular-nums",
        tone === "urgent" && count > 0
          ? "font-medium text-condition-attention"
          : "text-muted-foreground/70",
        arrivals > 0 &&
          "animate-in duration-500 fade-in-0 zoom-in-150 motion-reduce:animate-none",
      )}
    >
      {count}
    </span>
  );
  const hintText = hint && (
    <span className="ml-auto truncate pl-2 text-[11px] text-muted-foreground/60">
      {hint}
    </span>
  );

  // Inset like a card's text, so a lane's title lines up with its cards.
  const headingClassName = cn("mb-2 flex items-baseline border-b px-3", border);

  if (!fold) {
    return (
      <Element
        aria-label={title}
        className={cn("flex flex-col xl:min-h-0", className)}
      >
        <h2 className={cn(headingClassName, "gap-2 pb-1.5")}>
          {titleText}
          {countText}
          {hintText}
        </h2>
        {children}
      </Element>
    );
  }

  const chevron = (
    <ChevronRight
      aria-hidden
      className={cn(
        "size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover:text-foreground motion-reduce:transition-none",
        open && "rotate-90",
      )}
    />
  );

  return (
    <Element
      aria-label={title}
      className={cn("flex flex-col xl:min-h-0", className)}
    >
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="flex flex-col xl:min-h-0 xl:flex-1"
      >
        {/* Keep a real heading while making the whole rule the trigger. */}
        <h2
          className={cn(
            headingClassName,
            railed && "xl:mb-0 xl:flex-1 xl:border-b-0 xl:px-0",
          )}
        >
          <CollapsibleTrigger
            className={cn(
              "group flex w-full items-baseline gap-2 pb-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              railed &&
                "xl:h-full xl:w-14 xl:flex-col xl:items-center xl:gap-1.5 xl:rounded-2xl xl:border xl:border-border/70 xl:py-3 xl:text-center xl:transition-colors xl:hover:bg-muted/60",
            )}
          >
            {titleText}
            {countText}
            {railed ? (
              // Folded, the hint gives way to when the next item arrives.
              <>
                {fold.next && (
                  <span className="ml-auto flex gap-1 pl-2 text-[11px] text-muted-foreground/70 tabular-nums xl:ml-0 xl:flex-col xl:gap-0 xl:pl-0">
                    <span>next</span> <span>{fold.next}</span>
                  </span>
                )}
                {!fold.next && <span className="ml-auto xl:hidden" />}
              </>
            ) : (
              (hintText ?? <span className="ml-auto" />)
            )}
            {chevron}
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent className="flex flex-col xl:min-h-0 xl:flex-1">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </Element>
  );
}
