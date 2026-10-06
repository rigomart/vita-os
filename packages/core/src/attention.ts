/**
 * How Vita OS decides what deserves attention, and in what order.
 *
 * Pure grouping over values the caller already holds, so the awareness model
 * cannot drift between the surfaces that read it. Nothing here knows about
 * storage, React, or a transport.
 */

export interface ThreadAttentionInput {
  /** Until the Thread's own Follow-up date is folded into its Tasks (ADR 0032). */
  followUp?: number | null;
  tasks?: readonly { date?: number }[];
  order: number;
}

/**
 * A Thread with Tasks and no dated one is ready to move. Focus and the number
 * of Tasks never decide a group: timing belongs to dated Tasks.
 */
export interface ThreadAttentionGroups<TThread> {
  open: TThread[];
  overdue: TThread[];
  upcoming: TThread[];
  withTasks: TThread[];
}

const DAY = 86_400_000;

/** The earliest date any of the Tasks carries, or `undefined` when none is dated. */
export function soonestTaskDate(
  tasks: readonly { date?: number }[] | undefined,
): number | undefined {
  let soonest: number | undefined;
  for (const task of tasks ?? []) {
    if (
      task.date !== undefined &&
      (soonest === undefined || task.date < soonest)
    ) {
      soonest = task.date;
    }
  }
  return soonest;
}

/**
 * When a Thread comes back: its soonest dated Task. While the Thread's own
 * Follow-up date still exists (ADR 0032), the earlier of the two.
 */
export function attentionDate(thread: {
  followUp?: number | null;
  tasks?: readonly { date?: number }[];
}): number | undefined {
  const task = soonestTaskDate(thread.tasks);
  const followUp = thread.followUp ?? undefined;
  if (task === undefined) return followUp;
  if (followUp === undefined) return task;
  return Math.min(task, followUp);
}

export function groupThreadsByAttention<TThread extends ThreadAttentionInput>(
  threads: TThread[],
  currentDate: number,
  timezoneOffsetMinutes?: number,
): ThreadAttentionGroups<TThread> {
  const today = getDayKey(currentDate, timezoneOffsetMinutes);
  const groups: ThreadAttentionGroups<TThread> = {
    overdue: [],
    withTasks: [],
    upcoming: [],
    open: [],
  };

  for (const thread of threads) {
    const date = attentionDate(thread);
    if (date !== undefined) {
      if (getDayKey(date, timezoneOffsetMinutes) < today) {
        groups.overdue.push(thread);
      } else {
        groups.upcoming.push(thread);
      }
    } else if ((thread.tasks?.length ?? 0) > 0) {
      groups.withTasks.push(thread);
    } else {
      groups.open.push(thread);
    }
  }

  groups.overdue.sort(compareDates);
  groups.upcoming.sort(compareDates);
  groups.withTasks.sort(compareThreadOrder);
  groups.open.sort(compareThreadOrder);

  return groups;
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * The time of day a Follow-up date carries, as `HH:mm`, or
 * `undefined` when it carries only a date.
 *
 * A date alone is stored as local midnight, so midnight is the one time that
 * cannot be chosen: it reads as no time at all.
 */
export function timeOfDay(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The local day of `timestamp` at `time` (`HH:mm`), or that day alone when no
 * time is given.
 */
export function withTimeOfDay(timestamp: number, time?: string): number {
  const day = startOfLocalDay(timestamp);
  const match = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  if (!match) return day;
  const date = new Date(day);
  date.setHours(Number(match[1]), Number(match[2]));
  return date.getTime();
}

function getDayKey(timestamp: number, timezoneOffsetMinutes?: number) {
  if (timezoneOffsetMinutes === undefined) {
    return startOfLocalDay(timestamp);
  }

  return Math.floor((timestamp - timezoneOffsetMinutes * 60_000) / DAY);
}

function compareDates<TThread extends ThreadAttentionInput>(
  a: TThread,
  b: TThread,
) {
  return (
    (attentionDate(a) ?? 0) - (attentionDate(b) ?? 0) ||
    compareThreadOrder(a, b)
  );
}

function compareThreadOrder<TThread extends ThreadAttentionInput>(
  a: TThread,
  b: TThread,
) {
  return a.order - b.order;
}
