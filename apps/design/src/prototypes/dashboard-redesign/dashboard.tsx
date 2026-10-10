import type {
  BoardGroup,
  BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import type { ReactNode } from "react";

import {
  groupByWhen,
  itemId,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import {
  dateToken,
  dayDelta,
} from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown, MessageSquarePlus, PenLine, Search } from "lucide-react";
import { useState } from "react";

import {
  type Board,
  emptyMessage,
  Item,
  itemTitle,
  unscheduledRuns,
  unscheduledTotal,
  useBoard,
  useOpenItem,
} from "./board";
import { Filter } from "./filter";
import { PrototypeShell, useShell } from "./shell";
import { SkyHeader } from "./sky";

/**
 * The Dashboard as one page: the sky for a header, one list read from what is
 * asking now down to what is far off, each day on a tab of its own, and what
 * has no date pinned beside it. The page scrolls; the filter sticks to the top
 * of the list and No date to the side.
 *
 * Below `lg`, where there is no room beside the list, No date leads it as a
 * folded tab, and the actions move to a bar at the bottom, in reach of a
 * thumb.
 */
export function NextDashboard() {
  return (
    <PrototypeShell>
      <Screen />
    </PrototypeShell>
  );
}

function Screen() {
  const board = useBoard();

  return (
    <div className="min-h-svh bg-surface-1">
      <SkyHeader today={board?.currentDate ?? Date.now()} />

      {board && (
        <div className="mx-auto grid max-w-[76rem] gap-x-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="min-w-0 pb-32">
            <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-3 lg:px-3">
              <Filter board={board} />
            </div>
            <FoldedNoDate board={board} />
            {board.empty ? (
              <p className="pt-3 text-[15px] text-muted-foreground">
                {emptyMessage(board.filter)}
              </p>
            ) : (
              <List board={board} />
            )}
          </main>
          <aside
            aria-label="No date"
            className="hidden min-w-0 pt-6 pb-24 [scrollbar-width:thin] lg:sticky lg:top-0 lg:-mr-3 lg:block lg:h-svh lg:self-start lg:overflow-y-auto lg:border-l lg:pr-3 lg:pl-8"
          >
            <NoDate board={board} />
          </aside>
        </div>
      )}

      <BottomBar />
    </div>
  );
}

/* ------------------------------------------------------------------ list */

/** How far a group stands from today: 0 is now, 5 the far months. */
function distanceOf(group: BoardGroup, board: Board): number {
  const days = dayDelta(
    group.items[0]?.when ?? board.currentDate,
    board.currentDate,
  );
  if (days <= 0) return 0;
  if (days === 1) return 1;
  if (days <= 3) return 2;
  if (days <= 6) return 3;
  return group.key.startsWith("week") ? 4 : 5;
}

/** Nearer reads larger and darker, in small steps. */
const headings = [
  "text-xl font-semibold text-foreground",
  "text-lg font-semibold text-foreground",
  "text-base font-semibold text-foreground/85",
  "text-[15px] font-medium text-foreground/75",
  "text-sm font-medium text-muted-foreground",
  "text-sm font-medium text-muted-foreground/80",
];

/**
 * The fill a day sits on: Late warm, Today raised most, then less with each
 * step away. Solid, so the tab and its body are one shape.
 */
function fillOf(group: BoardGroup, distance: number) {
  if (group.tone === "late") {
    return "bg-[color-mix(in_oklab,var(--color-condition-attention)_9%,var(--color-surface-1))]";
  }
  if (distance === 0) return "bg-surface-2";
  if (distance <= 2) {
    return "bg-[color-mix(in_oklab,var(--color-surface-2)_70%,var(--color-surface-1))]";
  }
  return "bg-[color-mix(in_oklab,var(--color-surface-2)_45%,var(--color-surface-1))]";
}

/**
 * Every dated item in one list, what is asking first: Late, Today, then each
 * day of the week, then weeks and months. From next week on an item is a
 * single line, since it is only there to be known about. When the list is
 * wide enough, cards sit two to a row.
 */
function List({ board }: { board: Board }) {
  const { now, week, later } = board.board;
  const groups = groupByWhen([...now, ...week, ...later], board.currentDate);

  return (
    <div className="@container">
      {groups.length === 0 && (
        <p className="pt-2 text-[15px] text-muted-foreground">
          Nothing is on the calendar.
        </p>
      )}
      <div className="flex flex-col gap-4 pt-2">
        {groups.map((group) => {
          const distance = distanceOf(group, board);
          return (
            <Tab
              key={group.key}
              label={group.label}
              fill={fillOf(group, distance)}
              heading={
                <>
                  <span
                    className={cn(
                      "font-heading tracking-tight",
                      headings[distance],
                      group.tone === "late" && "text-condition-attention",
                    )}
                  >
                    {group.label}
                  </span>
                  <Hint group={group} />
                  <Count count={group.items.length} />
                </>
              }
            >
              <Run board={board} group={group} distance={distance} />
            </Tab>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A day as one shape, like a file tab on its folder: the heading on a tab,
 * the cards on the fill below, the corner where they meet turned inward.
 */
function Tab({
  label,
  fill,
  heading,
  children,
}: {
  label: string;
  fill: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label}>
      <div className="flex">
        <div className={cn("relative rounded-t-xl", fill)}>
          <h2 className="flex items-baseline gap-2.5 px-4 pt-2 pb-1">
            {heading}
          </h2>
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0 left-full size-3 [mask-image:radial-gradient(circle_at_100%_0,transparent_11.5px,black_12px)]",
              fill,
            )}
          />
        </div>
      </div>
      <div className={cn("rounded-2xl rounded-tl-none p-1.5", fill)}>
        {children}
      </div>
    </section>
  );
}

function Hint({ group }: { group: BoardGroup }) {
  const hint = group.hint?.match(/^\d+d$/)
    ? `in ${group.hint.slice(0, -1)} days`
    : group.hint;
  return hint ? (
    <span className="text-[13px] text-muted-foreground">{hint}</span>
  ) : null;
}

function Count({ count }: { count: number }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground/60">
      {count}
    </span>
  );
}

/**
 * A run's cards, or from next week on its one-line rows. Late's cards drop
 * their own tint, since the fill they sit on already says it. (In the app
 * this wants an option on the card, not an override.)
 */
function Run({
  board,
  group,
  distance,
}: {
  board: Board;
  group: BoardGroup;
  distance: number;
}) {
  if (distance >= 4) return <Lines board={board} items={group.items} />;
  return (
    <ul
      className={cn(
        "grid gap-x-1 @2xl:grid-cols-2",
        group.tone === "late" && "[&>li>div]:bg-transparent",
      )}
    >
      {group.items.map((item) => (
        <li key={itemId(item)}>
          <Item board={board} item={item} dateInHeading={group.exact} />
        </li>
      ))}
    </ul>
  );
}

/** Far enough away to be a line each: what it is, and when. */
function Lines({ board, items }: { board: Board; items: BoardItem[] }) {
  const open = useOpenItem();
  return (
    <ul className="grid gap-x-1 @2xl:grid-cols-2">
      {items.map((item) => (
        <li key={itemId(item)}>
          <button
            type="button"
            onClick={() => open(item)}
            className="flex w-full items-baseline gap-3 rounded-lg px-3 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 -translate-y-px rounded-full",
                item.kind === "note"
                  ? "border border-muted-foreground"
                  : "bg-muted-foreground/70",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{itemTitle(item)}</span>
            {item.when !== undefined && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {dateToken(item.when, board.currentDate)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- no date */

function Runs({ board }: { board: Board }) {
  return unscheduledRuns(board.board).map((run) => (
    <section key={run.key} aria-label={run.title}>
      <h3 className="flex items-baseline gap-2 pb-1 text-[13px] font-semibold text-muted-foreground">
        {run.title}
        <span className="font-normal tabular-nums opacity-70">
          {run.items.length}
        </span>
      </h3>
      <ul className="-mx-3 flex flex-col">
        {run.items.map((item) => (
          <li key={itemId(item)}>
            <Item board={board} item={item} />
          </li>
        ))}
      </ul>
    </section>
  ));
}

/** What has no date: its three runs, under one heading. */
function NoDate({ board }: { board: Board }) {
  const total = unscheduledTotal(board.board);
  return (
    <>
      <h2 className="flex items-baseline gap-2">
        <span className="font-heading text-xl font-semibold tracking-tight">
          No date
        </span>
        <Count count={total} />
      </h2>
      {total === 0 ? (
        <p className="pt-2 text-[15px] text-muted-foreground">
          Everything open has a date.
        </p>
      ) : (
        <div className="flex flex-col gap-5 pt-4">
          <Runs board={board} />
        </div>
      )}
    </>
  );
}

/**
 * Below `lg`, No date leads the list as a tab folded to one line — what it
 * holds, by name — so it is seen on first view without pushing the days down.
 */
function FoldedNoDate({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  const items = unscheduledRuns(board.board).flatMap((run) => run.items);
  if (items.length === 0) return null;

  const names = items.slice(0, 2).map(itemTitle).join(", ");
  const rest = items.length - 2;

  return (
    <div className="pt-1 pb-3 lg:hidden">
      <Tab
        label="No date"
        fill="bg-[color-mix(in_oklab,var(--color-surface-2)_55%,var(--color-surface-1))]"
        heading={
          <>
            <span className="font-heading text-base font-semibold tracking-tight">
              No date
            </span>
            <Count count={items.length} />
          </>
        }
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
        >
          <span className="min-w-0 flex-1 truncate">
            {open ? "Hide" : `${names}${rest > 0 ? ` and ${rest} more` : ""}`}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div className="flex flex-col gap-4 px-3 pt-1 pb-2">
            <Runs board={board} />
          </div>
        )}
      </Tab>
    </div>
  );
}

/* ------------------------------------------------------------ bottom bar */

/**
 * Below `lg`, the actions the header holds on a wide screen, where a thumb
 * reaches them: search as a field filling the bar, then a new Thread and a
 * new Note.
 */
function BottomBar() {
  const { newNote, newThread, openPalette } = useShell();

  return (
    <nav
      aria-label="Actions"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex h-14 max-w-md items-center gap-1.5 rounded-full border bg-surface-2/90 px-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.4)] backdrop-blur-xl lg:hidden"
    >
      <button
        type="button"
        onClick={openPalette}
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/70 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="truncate">Search</span>
      </button>
      <BarButton label="New thread" onClick={newThread}>
        <MessageSquarePlus className="size-[18px]" />
      </BarButton>
      <button
        type="button"
        onClick={newNote}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-surface-1"
      >
        <PenLine aria-hidden className="size-4" />
        Note
      </button>
    </nav>
  );
}

function BarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
