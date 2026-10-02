/**
 * How Vita OS decides what deserves attention, and in what order.
 *
 * Pure grouping over values the caller already holds: the Dashboard, the Area
 * page, and the Notes screen all read the same rules, so the awareness model
 * cannot drift between them. Nothing here knows about storage, React, or a
 * transport.
 */

export interface ThreadAttentionInput {
  followUp?: number | null;
  moves?: readonly unknown[];
  order: number;
}

/**
 * A Thread with at least one Move and no Follow-up is ready to move. Focus and
 * the number of Moves never decide a group: timing belongs to Follow-ups.
 */
export interface ThreadAttentionGroups<TThread> {
  open: TThread[];
  overdue: TThread[];
  upcoming: TThread[];
  withMoves: TThread[];
}

export interface NoteAttentionInput {
  completedAt?: number | null;
  createdAt: number;
  state: "done" | "open";
  followUp?: number | null;
}

export interface NoteAttentionGroups<TNote> {
  comingUp: TNote[];
  completed: TNote[];
  noDate: TNote[];
  pastDue: TNote[];
  today: TNote[];
}

type NoteAttentionGroup = keyof NoteAttentionGroups<never>;

const DAY = 86_400_000;

const noteGroupOrder: Record<NoteAttentionGroup, number> = {
  pastDue: 0,
  today: 1,
  noDate: 2,
  comingUp: 3,
  completed: 4,
};

export function groupThreadsByAttention<TThread extends ThreadAttentionInput>(
  threads: TThread[],
  currentDate: number,
  timezoneOffsetMinutes?: number,
): ThreadAttentionGroups<TThread> {
  const today = getDayKey(currentDate, timezoneOffsetMinutes);
  const groups: ThreadAttentionGroups<TThread> = {
    overdue: [],
    withMoves: [],
    upcoming: [],
    open: [],
  };

  for (const thread of threads) {
    if (thread.followUp != null) {
      if (getDayKey(thread.followUp, timezoneOffsetMinutes) < today) {
        groups.overdue.push(thread);
      } else {
        groups.upcoming.push(thread);
      }
    } else if ((thread.moves?.length ?? 0) > 0) {
      groups.withMoves.push(thread);
    } else {
      groups.open.push(thread);
    }
  }

  groups.overdue.sort(compareFollowUps);
  groups.upcoming.sort(compareFollowUps);
  groups.withMoves.sort(compareThreadOrder);
  groups.open.sort(compareThreadOrder);

  return groups;
}

export function groupNotesByAttention<TNote extends NoteAttentionInput>(
  notes: TNote[],
  currentDate: number,
  timezoneOffsetMinutes?: number,
): NoteAttentionGroups<TNote> {
  const groups: NoteAttentionGroups<TNote> = {
    pastDue: [],
    today: [],
    noDate: [],
    comingUp: [],
    completed: [],
  };

  for (const note of [...notes].sort((a, b) =>
    compareNotesByAttention(a, b, currentDate, timezoneOffsetMinutes),
  )) {
    groups[
      getNoteAttentionGroup(note, currentDate, timezoneOffsetMinutes)
    ].push(note);
  }

  return groups;
}

export function isOpenNote(note: Pick<NoteAttentionInput, "state">) {
  return note.state === "open";
}

export function compareNotesByAttention<TNote extends NoteAttentionInput>(
  a: TNote,
  b: TNote,
  currentDate: number,
  timezoneOffsetMinutes?: number,
) {
  const aGroup = getNoteAttentionGroup(a, currentDate, timezoneOffsetMinutes);
  const bGroup = getNoteAttentionGroup(b, currentDate, timezoneOffsetMinutes);
  const groupDifference = noteGroupOrder[aGroup] - noteGroupOrder[bGroup];

  if (groupDifference !== 0) return groupDifference;

  if (aGroup === "completed") {
    return (
      (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt) ||
      b.createdAt - a.createdAt
    );
  }

  if (aGroup === "pastDue" || aGroup === "comingUp") {
    return (a.followUp ?? 0) - (b.followUp ?? 0) || b.createdAt - a.createdAt;
  }

  return b.createdAt - a.createdAt;
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

function getNoteAttentionGroup(
  note: NoteAttentionInput,
  currentDate: number,
  timezoneOffsetMinutes?: number,
): NoteAttentionGroup {
  if (note.state === "done") return "completed";
  if (note.followUp == null) return "noDate";

  const attention = getDayKey(note.followUp, timezoneOffsetMinutes);
  const today = getDayKey(currentDate, timezoneOffsetMinutes);

  if (attention < today) return "pastDue";
  if (attention === today) return "today";
  return "comingUp";
}

function getDayKey(timestamp: number, timezoneOffsetMinutes?: number) {
  if (timezoneOffsetMinutes === undefined) {
    return startOfLocalDay(timestamp);
  }

  return Math.floor((timestamp - timezoneOffsetMinutes * 60_000) / DAY);
}

function compareFollowUps<TThread extends ThreadAttentionInput>(
  a: TThread,
  b: TThread,
) {
  return (a.followUp ?? 0) - (b.followUp ?? 0) || compareThreadOrder(a, b);
}

function compareThreadOrder<TThread extends ThreadAttentionInput>(
  a: TThread,
  b: TThread,
) {
  return a.order - b.order;
}
