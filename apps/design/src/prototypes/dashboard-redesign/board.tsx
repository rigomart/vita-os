import type { AreaSummary } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  useAreas,
  useOpenNotes,
  useOpenThreads,
  useTheme,
  useViewer,
} from "@vita-os/application";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
import {
  type AttentionBoard,
  type BoardItem,
  boardItems,
  buildAttentionBoard,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import {
  type DashboardFilter,
  type DashboardFilterOption,
  filterDashboard,
} from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardNote } from "@vita-os/application/internal/dashboard/components/dashboard-note.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import { UserMenu } from "@vita-os/application/internal/layout/user-menu.tsx";
import { isApplePlatform } from "@vita-os/application/internal/lib/platform.ts";
import { withDashboardFilter } from "@vita-os/application/internal/navigation/search-params.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { ConnectedThreadAttentionCard } from "@vita-os/application/internal/threads/components/thread-attention-card.tsx";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { cn } from "@vita-os/ui/lib/utils";
import { Layers, StickyNote, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { useShell } from "./shell";

export interface Board {
  areaById: Map<string, AreaSummary>;
  board: AttentionBoard;
  currentDate: number;
  /** Nothing open under the current filter. */
  empty: boolean;
  filter: DashboardFilter;
  options: DashboardFilterOption[];
}

/**
 * The shipped Dashboard's data, unchanged: the same three reads, the same
 * filter and the same placement, so every direction lays out one board.
 */
export function useBoard(): Board | undefined {
  const currentDate = useAttentionClock();
  const params = useDashboardFilterParams();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
  if (areas === undefined || threads === undefined || notes === undefined) {
    return undefined;
  }

  const filtered = filterDashboard({ threads, notes, areas, params });
  const board = buildAttentionBoard(
    filtered.threads,
    filtered.notes,
    currentDate,
  );
  return {
    areaById: new Map(areas.map((area) => [area._id, area])),
    board,
    currentDate,
    empty: boardItems(board).length === 0,
    filter: filtered.filter,
    options: filtered.options,
  };
}

/** The wall clock to the minute, for anything drawn against the hour. */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** One item on the board, in the card it wears on the shipped Dashboard. */
export function Item({
  board,
  item,
  dateInHeading = false,
}: {
  board: Board;
  item: BoardItem;
  dateInHeading?: boolean;
}) {
  const { openNote } = useShell();
  if (item.kind === "note") {
    return (
      <DashboardNote
        currentDate={board.currentDate}
        dateInHeading={dateInHeading}
        note={item.note}
        onOpenNote={openNote}
      />
    );
  }
  const { areaId } = item.thread;
  return (
    <ConnectedThreadAttentionCard
      area={areaId === undefined ? undefined : board.areaById.get(areaId)}
      currentDate={board.currentDate}
      dateInHeading={dateInHeading}
      thread={item.thread}
    />
  );
}

/** What an item is called in a line of text: its title, or a Note's first line. */
export function itemTitle(item: BoardItem) {
  if (item.kind === "thread") return item.thread.title;
  const text = markdownToPlainText(item.note.body).trim();
  return text.split("\n")[0] ?? text;
}

/** Opens an item where the board would: a Thread's pane, or the Note view. */
export function useOpenItem() {
  const navigate = useNavigate();
  const { openNote } = useShell();
  return (item: BoardItem) => {
    if (item.kind === "note") {
      openNote(item.note);
      return;
    }
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        thread: item.thread.slug,
      }),
    } as never);
  };
}

/** The unscheduled runs, in the order the margin reads them. */
export function unscheduledRuns(board: AttentionBoard) {
  return [
    { key: "moves", title: "Ready to move", items: board.unscheduled.moves },
    { key: "open", title: "Open", items: board.unscheduled.open },
    { key: "notes", title: "Notes", items: board.unscheduled.notes },
  ].filter((run) => run.items.length > 0);
}

export function unscheduledTotal(board: AttentionBoard) {
  return unscheduledRuns(board).reduce((n, run) => n + run.items.length, 0);
}

const spelled = [
  "Nothing",
  "One thing",
  "Two things",
  "Three things",
  "Four things",
  "Five things",
  "Six things",
  "Seven things",
  "Eight things",
  "Nine things",
];

/** Says what is asking, in words, with no alarm in it. */
export function nowSentence(count: number) {
  const subject = spelled[count] ?? `${count} things`;
  if (count === 0) return "Nothing is asking for you today.";
  return `${subject} ${count === 1 ? "is" : "are"} asking for you today.`;
}

/** What the board says when the filter leaves it empty. */
export function emptyMessage(filter: DashboardFilter) {
  if (filter.kind === "area") return `Nothing open in ${filter.area.name}.`;
  if (filter.kind === "notes") return "No note is waiting.";
  if (filter.kind === "none") return "Every open thread has an area.";
  return "Nothing is open. Write something down when it comes to mind.";
}

/** A filter choice as a link, so it is addressable and keeps the URL. */
export function FilterLink({
  option,
  className,
  children,
}: {
  option: DashboardFilterOption;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to="."
      search={withDashboardFilter(option.search) as never}
      aria-current={option.selected ? "true" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

export function useSetFilter() {
  const navigate = useNavigate();
  return (option: DashboardFilterOption) =>
    void navigate({
      to: ".",
      search: withDashboardFilter(option.search),
    } as never);
}

export function FilterIcon({
  option,
  className = "size-3.5 shrink-0",
}: {
  option: DashboardFilterOption;
  className?: string;
}) {
  if (option.area !== undefined) {
    return <AreaIcon icon={option.area.icon} className={className} />;
  }
  const Icon =
    option.key === "notes"
      ? StickyNote
      : option.search.area === undefined
        ? Layers
        : Tag;
  return <Icon aria-hidden className={className} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/vita-logo.svg"
      alt=""
      className={cn("size-7 shrink-0 rounded-lg", className)}
    />
  );
}

export function Account() {
  const { viewer, signOut } = useViewer();
  const { theme, setTheme } = useTheme();
  return (
    <UserMenu
      user={viewer}
      theme={theme}
      onThemeChange={setTheme}
      onSignOut={signOut}
    />
  );
}

/** ⌘K or Ctrl K, as this keyboard has it. */
export function paletteKey() {
  const apple = isApplePlatform();
  return {
    hint: apple ? "⌘K" : "Ctrl K",
    label: apple ? "Command K" : "Control K",
  };
}

/** A date in words, as the product's English interface writes it. */
export function formatDate(
  timestamp: number | Date,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(timestamp).toLocaleDateString("en-US", options);
}
