import type {
  ActivityLogEntryId,
  AreaId,
  TaskId,
  NoteId,
  ThreadId,
  ThreadNoteId,
} from "./ids";

/**
 * What Vita OS is made of, as the application boundary describes it.
 *
 * These are plain values: no framework types, no storage rows, no generated
 * identifiers. Optional properties are absent rather than null — a saved
 * value and an unset one stay distinguishable, exactly as they were.
 */

export type AreaIcon =
  | "Compass"
  | "HeartPulse"
  | "Dumbbell"
  | "Users"
  | "Home"
  | "BriefcaseBusiness"
  | "WalletCards"
  | "BookOpen"
  | "Utensils"
  | "Car"
  | "CalendarDays"
  | "Palette"
  | "Leaf"
  | "Shield"
  | "Plane";

export interface AreaSummary {
  _id: AreaId;
  name: string;
  slug: string;
  icon: AreaIcon;
  order: number;
  createdAt: number;
}

export type ThreadState = "open" | "resolved";

export interface Thread {
  _id: ThreadId;
  title: string;
  slug: string;
  summary?: string;
  /** The Thread's Area label. Absent means the Thread has no Area. */
  areaId?: AreaId;
  order: number;
  state: ThreadState;
  /**
   * The Thread's Tasks: peers, in the order they were captured. The order is
   * for finding things, never a priority. Absent means the Thread holds none —
   * an empty list is never stored.
   */
  tasks?: Task[];
  /**
   * The one Task the person singled out, when they did. It is always one of
   * `tasks`. Focus is emphasis only: it never changes when the Thread surfaces.
   */
  focusedTaskId?: TaskId;
  followUp?: number;
  lastActivityAt?: number;
  lastActivityContent?: string;
  createdAt: number;
  /**
   * How many times the Thread has changed.
   *
   * Every read carries it, so any surface that shows a Task can also act on
   * one: the revision travels back with the command, and a request made against
   * a Thread that has since moved on is refused rather than applied twice.
   */
  revision: number;
}

/** One useful action a Thread holds: plain text, no date, no done state. */
export interface Task {
  _id: TaskId;
  text: string;
}

export interface ThreadDetail {
  thread: Thread;
  /** The Thread's Area, absent when the Thread has none. */
  area?: AreaSummary;
}

export type NoteState = "open" | "done";

/** A Standalone Note: captured on its own, attached to no Thread. */
export interface Note {
  _id: NoteId;
  body: string;
  /** The Follow-up date, when the person gave the Note one. */
  followUp?: number;
  state: NoteState;
  completedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

/** A Note captured inside one Thread, and owned by it. */
export interface ThreadNote {
  _id: ThreadNoteId;
  body: string;
  state: NoteState;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * A Standalone Note added to a Thread: the Thread as it now stands — its
 * Follow-up date, activity, and revision — and the Thread Note the Note became.
 */
export interface NoteAddedToThread {
  thread: Thread;
  threadNote: ThreadNote;
}

/**
 * `next_move_change` is no longer written. Entries recorded before Tasks
 * replaced the Next Move keep it, and read as they always did.
 */
export type ActivityLogEntryType =
  | "area_move"
  | "next_move_change"
  | "move_completed"
  | "state_change"
  | "follow_up_change";

/** One automatic record of a Thread change. The Activity Log is read-only. */
export interface ActivityLogEntry {
  _id: ActivityLogEntryId;
  type: ActivityLogEntryType;
  content: string;
  previousValue?: string;
  newValue?: string;
  createdAt: number;
}

/**
 * One bounded page of a history that only grows, plus the opaque cursor that
 * reads the page behind it. An absent cursor means the history is exhausted.
 */
export interface Page<TEntry> {
  entries: TEntry[];
  nextCursor?: string;
}

export type ActivityLogPage = Page<ActivityLogEntry>;
export type NotePage = Page<Note>;
export type ThreadNotePage = Page<ThreadNote>;
