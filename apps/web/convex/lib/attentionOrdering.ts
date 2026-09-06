export interface ThreadAttentionInput {
  followUp?: number | null;
  nextMove?: string | null;
  order: number;
}

export interface ThreadAttentionGroups<TThread> {
  open: TThread[];
  overdue: TThread[];
  upcoming: TThread[];
  withNextMoves: TThread[];
}

export interface AreaThreadAttentionGroups<TThread> {
  dueNow: TThread[];
  open: TThread[];
  upcoming: TThread[];
  withNextMoves: TThread[];
}

export interface NoteAttentionInput {
  completedAt?: number | null;
  createdAt: number;
  state: "done" | "open";
  when?: number | null;
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
    withNextMoves: [],
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
    } else if (hasText(thread.nextMove)) {
      groups.withNextMoves.push(thread);
    } else {
      groups.open.push(thread);
    }
  }

  groups.overdue.sort(compareFollowUps);
  groups.upcoming.sort(compareFollowUps);
  groups.withNextMoves.sort(compareThreadOrder);
  groups.open.sort(compareThreadOrder);

  return groups;
}

export function groupAreaThreadsByAttention<
  TThread extends ThreadAttentionInput,
>(
  threads: TThread[],
  currentDate: number,
  timezoneOffsetMinutes?: number,
): AreaThreadAttentionGroups<TThread> {
  const today = getDayKey(currentDate, timezoneOffsetMinutes);
  const dashboardGroups = groupThreadsByAttention(
    threads,
    currentDate,
    timezoneOffsetMinutes,
  );
  const dueToday: TThread[] = [];
  const upcoming: TThread[] = [];

  for (const thread of dashboardGroups.upcoming) {
    if (getDayKey(thread.followUp ?? 0, timezoneOffsetMinutes) === today) {
      dueToday.push(thread);
    } else {
      upcoming.push(thread);
    }
  }

  return {
    dueNow: [...dashboardGroups.overdue, ...dueToday],
    upcoming,
    withNextMoves: dashboardGroups.withNextMoves,
    open: dashboardGroups.open,
  };
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
    return (a.when ?? 0) - (b.when ?? 0) || b.createdAt - a.createdAt;
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

function getNoteAttentionGroup(
  note: NoteAttentionInput,
  currentDate: number,
  timezoneOffsetMinutes?: number,
): NoteAttentionGroup {
  if (note.state === "done") return "completed";
  if (note.when == null) return "noDate";

  const when = getDayKey(note.when, timezoneOffsetMinutes);
  const today = getDayKey(currentDate, timezoneOffsetMinutes);

  if (when < today) return "pastDue";
  if (when === today) return "today";
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

function hasText(value: string | null | undefined) {
  return value != null && value.trim().length > 0;
}
