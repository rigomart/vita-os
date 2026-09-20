import type {
  ActivityLogEntryId,
  AreaId,
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

export type Condition = "healthy" | "needs_attention" | "critical";

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
  standard?: string;
  condition: Condition;
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
  areaId: AreaId;
  order: number;
  state: ThreadState;
  nextMove?: string;
  /**
   * The Up Next line behind the Next Move: plain ordered text. Absent means
   * nothing is lined up — an empty list is never stored, so a Thread without
   * Up Next reads as it always did. While this is present, `nextMove` is set.
   */
  upNext?: string[];
  followUp?: number;
  lastActivityAt?: number;
  lastActivityContent?: string;
  createdAt: number;
  /**
   * How many times the Thread has changed.
   *
   * Every read carries it, so any surface that shows a Next Move can also
   * complete one: the revision travels back with the command, and a request made
   * against a Thread that has since moved on is refused rather than applied
   * twice.
   */
  revision: number;
}

/** @deprecated Every `Thread` now carries its revision. */
export type VersionedThread = Thread;

export interface ThreadDetail {
  thread: VersionedThread;
  area: AreaSummary;
}

/** Everything the Area page renders: the Area and its Open Threads. */
export interface AreaDetail {
  area: AreaSummary;
  threads: Thread[];
}

export type NoteState = "open" | "done";

/** A Standalone Note: captured on its own, attached to no Thread. */
export interface Note {
  _id: NoteId;
  body: string;
  /** The Attention Date, when the user gave the Note one. */
  when?: number;
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

export type ActivityLogEntryType =
  | "area_move"
  | "next_action_change"
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
