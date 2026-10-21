import type { Note, Task, Thread } from "@vita-os/contracts";

import { hasTasks } from "@vita-os/core";
import { addDays, format } from "date-fns";

import { dayDelta, startOfLocalDay } from "./dashboard-model";

/**
 * The Dashboard board is one axis — **when** — plus No date for everything
 * that has no place on it.
 *
 * Three buckets carry the dates (Now · This week · Later), which the
 * Dashboard reads as one list from now outward, and a single unscheduled
 * group carries what is not on the calendar at all: Threads whose Tasks are
 * all undated (ready to move), Threads simply open, and standalone Notes.
 * Every dated Task places a copy of its Thread at its date, so a Thread with
 * three dated Tasks stands three times; a repeating Task is one Task with one
 * date, so it places one copy, at its next occurrence. A Note's Follow-up
 * date is the same kind of signal, so a Note due tomorrow sits beside a Task
 * due tomorrow.
 *
 * A Thread with a dated Task is never in the unscheduled group, and its
 * undated Tasks are not on the board: every dated Task and dated Note lands
 * in exactly one group, and every undated item in exactly one run.
 */
export interface AttentionBoard {
  later: BoardItem[];
  now: BoardItem[];
  unscheduled: {
    /** Threads with Tasks, none of them dated: what you could do today. */
    moves: BoardItem[];
    /** Standalone Notes with no follow-up date. */
    notes: BoardItem[];
    /** Threads with no Tasks. */
    open: BoardItem[];
  };
  week: BoardItem[];
}

export type BoardItem =
  | { kind: "note"; note: Note; when?: number }
  | {
      kind: "thread";
      thread: Thread;
      /** The dated Task that placed this copy; none in No date. */
      task?: Task;
      when?: number;
    };

/** The last six days of "soon" — day 7 and beyond reads as Later. */
const WEEK_HORIZON = 6;

/** From four weeks out, a week is too fine a grain and a month takes over. */
const MONTH_HORIZON = 28;

/**
 * A run of dated items that come due together, under one heading.
 *
 * The grain widens with distance: Now splits into Late and Today, This week
 * into its days, Later into weeks and then months. Every group reads label,
 * hint, count, so the list says when its items come due without anyone
 * reading each line's date.
 */
export interface BoardGroup {
  /**
   * The heading names the one day every item under it comes due, so its lines
   * leave their date to the heading.
   */
  exact: boolean;
  /** The weekday beside Tomorrow, how far out a day is, or a week's span. */
  hint?: string;
  items: BoardItem[];
  key: string;
  label: string;
  /** How loudly the heading reads: nearer is louder, and late alarms. */
  tone: "far" | "late" | "near" | "soon" | "today" | "week";
}

export function buildAttentionBoard(
  threads: Thread[],
  notes: Note[],
  currentDate: number,
): AttentionBoard {
  const items: BoardItem[] = [
    ...threads.flatMap((thread) =>
      datedTasks(thread).map(
        (task): BoardItem => ({
          kind: "thread",
          thread,
          task,
          when: task.date,
        }),
      ),
    ),
    ...notes.map(
      (note): BoardItem => ({
        kind: "note",
        note,
        when: note.followUp ?? undefined,
      }),
    ),
  ];

  const dated = items.filter((item) => item.when !== undefined);
  const undated = threads.filter((thread) => datedTasks(thread).length === 0);
  const inDays = (item: BoardItem) => dayDelta(item.when ?? 0, currentDate);

  return {
    now: dated.filter((item) => inDays(item) <= 0).sort(bySoonest),
    week: dated
      .filter((item) => inDays(item) >= 1 && inDays(item) <= WEEK_HORIZON)
      .sort(bySoonest),
    later: dated.filter((item) => inDays(item) > WEEK_HORIZON).sort(bySoonest),
    unscheduled: {
      moves: undated
        .filter((thread) => hasTasks(thread))
        .sort(byThreadOrder)
        .map((thread) => ({ kind: "thread", thread })),
      open: undated
        .filter((thread) => !hasTasks(thread))
        .sort(byThreadOrder)
        .map((thread) => ({ kind: "thread", thread })),
      notes: notes
        .filter((note) => note.followUp == null)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((note) => ({ kind: "note", note })),
    },
  };
}

/** Every open item on the board, dated or not. */
export function boardItems(board: AttentionBoard): BoardItem[] {
  return [
    ...board.now,
    ...board.week,
    ...board.later,
    ...board.unscheduled.moves,
    ...board.unscheduled.open,
    ...board.unscheduled.notes,
  ];
}

/** No date's runs, in the order they read, leaving out the empty ones. */
export function unscheduledRuns(board: AttentionBoard) {
  return [
    { key: "moves", title: "Ready to move", items: board.unscheduled.moves },
    { key: "open", title: "Open", items: board.unscheduled.open },
    { key: "notes", title: "Notes", items: board.unscheduled.notes },
  ].filter((run) => run.items.length > 0);
}

/**
 * Splits soonest-first items into the groups their dates fall in,
 * keeping their order. A day with nothing due gets no heading.
 */
export function groupByWhen(
  items: BoardItem[],
  currentDate: number,
): BoardGroup[] {
  const groups: BoardGroup[] = [];
  for (const item of items) {
    const group = groupFor(item.when ?? currentDate, currentDate);
    const last = groups.at(-1);
    if (last?.key === group.key) last.items.push(item);
    else groups.push({ ...group, items: [item] });
  }
  return groups;
}

function groupFor(
  when: number,
  currentDate: number,
): Omit<BoardGroup, "items"> {
  const days = dayDelta(when, currentDate);
  if (days < 0)
    return { key: "late", label: "Late", exact: false, tone: "late" };
  if (days === 0) {
    return { key: "today", label: "Today", exact: true, tone: "today" };
  }
  if (days === 1) {
    return {
      key: "day-1",
      label: "Tomorrow",
      hint: format(when, "EEEE"),
      exact: true,
      tone: "near",
    };
  }
  if (days <= WEEK_HORIZON) {
    return {
      key: `day-${days}`,
      label: format(when, "EEEE"),
      hint: `in ${days} days`,
      exact: true,
      tone: days <= 3 ? "soon" : "week",
    };
  }
  if (days < MONTH_HORIZON) {
    const weeks = Math.floor(days / 7);
    const today = startOfLocalDay(currentDate);
    return {
      key: `week-${weeks}`,
      label: weeks === 1 ? "In 1 week" : `In ${weeks} weeks`,
      hint: span(addDays(today, weeks * 7), addDays(today, weeks * 7 + 6)),
      exact: false,
      tone: "far",
    };
  }
  const sameYear =
    new Date(when).getFullYear() === new Date(currentDate).getFullYear();
  return {
    key: `month-${format(when, "yyyy-MM")}`,
    label: format(when, sameYear ? "MMMM" : "MMMM yyyy"),
    exact: false,
    tone: "far",
  };
}

/** Oct 8–14, or Oct 29–Nov 4 across a month's end. */
function span(start: Date, end: Date) {
  return start.getMonth() === end.getMonth()
    ? `${format(start, "MMM d")}–${format(end, "d")}`
    : `${format(start, "MMM d")}–${format(end, "MMM d")}`;
}

/**
 * The Tasks that place a Thread on the list, in capture order: one copy each.
 * A Thread with more than one stands more than once.
 */
export function datedTasks(thread: Thread): (Task & { date: number })[] {
  return (thread.tasks ?? []).filter(
    (task): task is Task & { date: number } => task.date !== undefined,
  );
}

/**
 * The one Task a Thread's line names and acts on: the Task that placed its
 * copy, or in No date the Thread's only Task. With several undated Tasks
 * there is none, as the line must not pick a headline the person never chose.
 */
export function lineTask(thread: Thread, placedBy?: Task): Task | undefined {
  if (placedBy !== undefined) return placedBy;
  const tasks = thread.tasks ?? [];
  return tasks.length === 1 ? tasks[0] : undefined;
}

/** The Thread or Note behind an item, whichever it is. */
export function itemId(item: BoardItem) {
  return item.kind === "thread" ? item.thread._id : item.note._id;
}

/** One copy among its Thread's: the Thread with the Task that placed it. */
export function itemKey(item: BoardItem) {
  return item.kind === "thread" && item.task !== undefined
    ? `${item.thread._id}:${item.task._id}`
    : itemId(item);
}

export function itemAreaId(item: BoardItem) {
  return item.kind === "thread" ? item.thread.areaId : undefined;
}

function bySoonest(a: BoardItem, b: BoardItem) {
  return (a.when ?? 0) - (b.when ?? 0);
}

function byThreadOrder(a: Thread, b: Thread) {
  return a.order - b.order;
}
