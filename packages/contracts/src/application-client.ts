import type { CommandAcknowledgement, OperationResult } from "./errors";
import type { AreaId, TaskId, NoteId, ThreadId, ThreadNoteId } from "./ids";
import type {
  ActivityLogPage,
  AreaIcon,
  AreaSummary,
  Note,
  NoteAddedToThread,
  NotePage,
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
  followUp?: Clearable<number>;
  state?: ThreadState;
  /** Carried into the Activity Log entry a resolution writes. */
  resolutionNote?: string;
}

/**
 * Every Task command names one Task by its ID and carries the revision the
 * caller read the Thread at. A stale revision, or a Task that is no longer
 * there, is refused as a conflict and writes nothing — so a command can never
 * land on a different Task than the one the person saw.
 */
interface TaskCommand {
  threadId: ThreadId;
  expectedRevision: number;
}

export interface AddTaskInput extends TaskCommand {
  /** Minted by the caller, so an optimistic Task keeps its name. */
  taskId: TaskId;
  text: string;
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
}

export interface FocusTaskInput extends TaskCommand {
  /** The Task to focus, replacing any earlier focus; `null` unfocuses. */
  taskId: Clearable<TaskId>;
}

export interface AddNoteToThreadInput {
  noteId: NoteId;
  threadId: ThreadId;
}

export interface CreateThreadFromNoteInput {
  noteId: NoteId;
  title: string;
  areaId?: AreaId;
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
  /** Removes the Task and records it as done in the Activity Log. */
  completeTask(input: CompleteTaskInput): Promise<OperationResult<Thread>>;
  focusTask(input: FocusTaskInput): Promise<OperationResult<Thread>>;

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
  createNote(input: {
    body: string;
    followUp?: number;
  }): Promise<OperationResult<Note>>;
  updateNoteBody(input: {
    noteId: NoteId;
    body: string;
  }): Promise<OperationResult<Note>>;
  updateNoteFollowUp(input: {
    noteId: NoteId;
    followUp: Clearable<number>;
  }): Promise<OperationResult<Note>>;
  markNoteDone(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  markNoteOpen(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  removeNote(input: {
    noteId: NoteId;
  }): Promise<OperationResult<CommandAcknowledgement>>;
  /**
   * Makes an Open Standalone Note a Thread Note on an Open Thread, keeping its
   * body and creation time. The earlier Follow-up date wins.
   */
  addNoteToThread(
    input: AddNoteToThreadInput,
  ): Promise<OperationResult<NoteAddedToThread>>;
  /** Starts a Thread whose first Thread Note is the Note, with its date. */
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
