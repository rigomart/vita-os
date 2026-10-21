import type { CommandAcknowledgement, OperationResult } from "./errors";
import type { AreaId, TaskId, NoteId, ThreadId, ThreadNoteId } from "./ids";
import type {
  ActivityLogPage,
  AreaIcon,
  AreaSummary,
  Note,
  NoteAddedToThread,
  NotePage,
  Repeat,
  Thread,
  ThreadDetail,
  ThreadNote,
  ThreadNotePage,
  ThreadState,
} from "./models";

/**
 * A value a caller may clear. Absent leaves the stored value alone; `null`
 * removes it. JSON cannot carry `undefined`, so clearing is spelled with
 * `null` all the way from the browser to storage.
 */
export type Clearable<T> = T | null;

/**
 * Creating an Area whose name matches one the owner already has returns that
 * Area instead of a duplicate, so a picker can create on type safely.
 */
export interface CreateAreaInput {
  name: string;
  icon: AreaIcon;
}

export interface UpdateAreaInput {
  areaId: AreaId;
  name?: string;
  icon?: AreaIcon;
}

export interface CreateThreadInput {
  title: string;
  summary?: string;
  areaId?: AreaId;
}

export interface UpdateThreadInput {
  threadId: ThreadId;
  title?: string;
  summary?: Clearable<string>;
  /** Sets, changes, or (with `null`) removes the Thread's Area. */
  areaId?: Clearable<AreaId>;
  state?: ThreadState;
  /** Carried into the Activity Log entry a resolution writes. */
  resolutionNote?: string;
}

/** Task commands apply to the current Thread and identify Tasks by their IDs. */
interface TaskCommand {
  threadId: ThreadId;
}

export interface AddTaskInput extends TaskCommand {
  /** Minted by the caller, so an optimistic Task keeps its name. */
  taskId: TaskId;
  text: string;
  /** A Task may be added already dated; capture itself never asks for one. */
  date?: number;
}

export interface EditTaskInput extends TaskCommand {
  taskId: TaskId;
  text: string;
}

export interface RemoveTaskInput extends TaskCommand {
  taskId: TaskId;
}

export interface CompleteTaskInput extends TaskCommand {
  taskId: TaskId;
  /** The displayed date, or null for an undated Task; refuses a changed occurrence. */
  expectedOccurrence: number | null;
  /** Required when the Task repeats. */
  timeZone?: string;
  /** A client-minted Thread Note captured atomically with completion. */
  note?: { id: ThreadNoteId; body: string };
}

export interface SetTaskDateInput extends TaskCommand {
  taskId: TaskId;
  /** Sets or changes the Task's date; `null` clears it. */
  date: Clearable<number>;
  /**
   * Required only when setting the date of a weekly-repeating Task, to snap
   * it, or of a monthly one, to move its Repeat to the new day of month.
   */
  timeZone?: string;
}

export interface SetTaskRepeatInput extends TaskCommand {
  taskId: TaskId;
  repeat: Clearable<Repeat>;
  timeZone: string;
}

export interface SkipTaskInput extends TaskCommand {
  taskId: TaskId;
  /** The displayed occurrence date; refuses if it has already advanced. */
  expectedOccurrence: number;
  timeZone: string;
}

export interface AddNoteToThreadInput {
  noteId: NoteId;
  threadId: ThreadId;
  /**
   * The ID of the Task a dated Note adds, minted by the caller so the Task it
   * shows keeps its name. Absent, the service mints one.
   */
  taskId?: TaskId;
}

export interface CreateThreadFromNoteInput {
  noteId: NoteId;
  title: string;
  areaId?: AreaId;
  /** As on `AddNoteToThreadInput`. */
  taskId?: TaskId;
}

export interface CreateNoteInput {
  body: string;
  followUp?: number;
  repeat?: Repeat;
  /** Required with a Repeat. */
  timeZone?: string;
}

export interface UpdateNoteFollowUpInput {
  noteId: NoteId;
  /** Sets or changes the date; `null` clears it and its Repeat. */
  followUp: Clearable<number>;
  /** Required when the Note repeats weekly or monthly, as for a Task. */
  timeZone?: string;
}

export interface SetNoteRepeatInput {
  noteId: NoteId;
  repeat: Clearable<Repeat>;
  timeZone: string;
}

export interface CompleteNoteInput {
  noteId: NoteId;
  /** The displayed date; refuses if it has already advanced. */
  expectedOccurrence: number;
  timeZone: string;
}

export interface PageRequest {
  limit: number;
  cursor?: string;
}

/**
 * A page of Archived Notes (stored as Done). `query` narrows it to the Notes
 * whose body contains every word of it; blank or absent reads them all.
 */
export interface DoneNotePageRequest extends PageRequest {
  query?: string;
}

/**
 * Every Vita OS operation, named after what the product does rather than after
 * a route, a table, or a transport.
 *
 * Implementations are plain and asynchronous: an HTTP client in the browser, a
 * local client in a future desktop host, a fake in tests. Loading state, page
 * accumulation, and optimistic behavior belong to the shared React
 * application, never to an implementation of this interface.
 */
export interface ApplicationClient {
  /* Areas */
  listAreas(): Promise<OperationResult<AreaSummary[]>>;
  createArea(input: CreateAreaInput): Promise<OperationResult<AreaSummary>>;
  updateArea(input: UpdateAreaInput): Promise<OperationResult<AreaSummary>>;
  /** Puts every Area in the given order; the list names each Area once. */
  reorderAreas(input: {
    areaIds: AreaId[];
  }): Promise<OperationResult<AreaSummary[]>>;
  /** Deletes the Area and removes it from every Thread that carries it. */
  removeArea(input: {
    areaId: AreaId;
  }): Promise<OperationResult<CommandAcknowledgement>>;

  /* Threads */
  listOpenThreads(): Promise<OperationResult<Thread[]>>;
  /** Resolved Threads, most recently resolved first; unknown resolution dates last. */
  listResolvedThreads(): Promise<OperationResult<Thread[]>>;
  getThreadDetail(input: {
    slug: string;
  }): Promise<OperationResult<ThreadDetail>>;
  createThread(input: CreateThreadInput): Promise<OperationResult<Thread>>;
  updateThread(input: UpdateThreadInput): Promise<OperationResult<Thread>>;
  removeThread(input: {
    threadId: ThreadId;
  }): Promise<OperationResult<CommandAcknowledgement>>;

  /* Tasks — each answers with the Thread as it now stands. */
  addTask(input: AddTaskInput): Promise<OperationResult<Thread>>;
  editTask(input: EditTaskInput): Promise<OperationResult<Thread>>;
  /** Drops the Task without a trace in the Activity Log. */
  removeTask(input: RemoveTaskInput): Promise<OperationResult<Thread>>;
  /** Records completion; a repeating Task advances, a one-off Task is removed. */
  completeTask(input: CompleteTaskInput): Promise<OperationResult<Thread>>;
  /** Sets, changes or clears one Task's date. Writes nothing to the Activity Log. */
  setTaskDate(input: SetTaskDateInput): Promise<OperationResult<Thread>>;
  setTaskRepeat(input: SetTaskRepeatInput): Promise<OperationResult<Thread>>;
  /** Advances a repeating Task without writing to the Activity Log. */
  skipTask(input: SkipTaskInput): Promise<OperationResult<Thread>>;

  /* Activity Log */
  getThreadActivityPage(
    input: { threadId: ThreadId } & PageRequest,
  ): Promise<OperationResult<ActivityLogPage>>;

  /* Standalone Notes */
  listOpenNotes(): Promise<OperationResult<Note[]>>;
  getDoneNotePage(
    input: DoneNotePageRequest,
  ): Promise<OperationResult<NotePage>>;
  countOpenNotes(): Promise<OperationResult<number>>;
  /** A Repeat needs the date and a zone; weekly and monthly snap the date. */
  createNote(input: CreateNoteInput): Promise<OperationResult<Note>>;
  updateNoteBody(input: {
    noteId: NoteId;
    body: string;
  }): Promise<OperationResult<Note>>;
  /** Sets, changes or clears the date; clearing it clears its Repeat too. */
  updateNoteFollowUp(
    input: UpdateNoteFollowUpInput,
  ): Promise<OperationResult<Note>>;
  /** A Repeat needs a date; weekly and monthly ones snap the date forward. */
  setNoteRepeat(input: SetNoteRepeatInput): Promise<OperationResult<Note>>;
  /**
   * Moves a repeating Note to its next occurrence, collapsing missed ones.
   * Records nothing; the Note stays open.
   */
  completeNote(input: CompleteNoteInput): Promise<OperationResult<Note>>;
  markNoteDone(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  markNoteOpen(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  removeNote(input: {
    noteId: NoteId;
  }): Promise<OperationResult<CommandAcknowledgement>>;
  /**
   * Makes an Open Standalone Note a Thread Note on an Open Thread, keeping its
   * body and creation time. A dated Note also adds a dated Task named by its
   * first line.
   */
  addNoteToThread(
    input: AddNoteToThreadInput,
  ): Promise<OperationResult<NoteAddedToThread>>;
  /**
   * Starts a Thread whose first Thread Note is the Note; a dated Note also
   * adds a dated Task named by its first line.
   */
  createThreadFromNote(
    input: CreateThreadFromNoteInput,
  ): Promise<OperationResult<NoteAddedToThread>>;

  /* Thread Notes */
  listOpenThreadNotes(input: {
    threadId: ThreadId;
  }): Promise<OperationResult<ThreadNote[]>>;
  getDoneThreadNotePage(
    input: { threadId: ThreadId } & PageRequest,
  ): Promise<OperationResult<ThreadNotePage>>;
  createThreadNote(input: {
    threadId: ThreadId;
    body: string;
  }): Promise<OperationResult<ThreadNote>>;
  updateThreadNoteBody(input: {
    threadNoteId: ThreadNoteId;
    body: string;
  }): Promise<OperationResult<ThreadNote>>;
  markThreadNoteDone(input: {
    threadNoteId: ThreadNoteId;
  }): Promise<OperationResult<ThreadNote>>;
  markThreadNoteOpen(input: {
    threadNoteId: ThreadNoteId;
  }): Promise<OperationResult<ThreadNote>>;
  removeThreadNote(input: {
    threadNoteId: ThreadNoteId;
  }): Promise<OperationResult<CommandAcknowledgement>>;
}
