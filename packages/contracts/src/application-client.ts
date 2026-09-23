import type { CommandAcknowledgement, OperationResult } from "./errors";
import type { AreaId, NoteId, ThreadId, ThreadNoteId } from "./ids";
import type {
  ActivityLogPage,
  AreaDetail,
  AreaIcon,
  AreaSummary,
  Condition,
  Note,
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

export interface CreateAreaInput {
  name: string;
  standard?: string;
  condition: Condition;
  icon: AreaIcon;
}

export interface UpdateAreaInput {
  areaId: AreaId;
  name?: string;
  standard?: Clearable<string>;
  condition?: Condition;
  icon?: AreaIcon;
}

export interface CreateThreadInput {
  title: string;
  summary?: string;
  areaId: AreaId;
}

export interface UpdateThreadInput {
  threadId: ThreadId;
  title?: string;
  summary?: Clearable<string>;
  areaId?: AreaId;
  nextMove?: Clearable<string>;
  followUp?: Clearable<number>;
  state?: ThreadState;
  /** Carried into the Activity Log entry a resolution writes. */
  resolutionNote?: string;
}

export interface CompleteNextMoveInput {
  threadId: ThreadId;
  /** The Next Move the caller means to complete, as it was read. */
  expectedNextMove: Clearable<string>;
  /** The revision the Next Move was read at. */
  expectedRevision: number;
}

export type CompleteNextMoveOutput =
  | { status: "completed" }
  | { status: "unchanged" };

export interface PageRequest {
  limit: number;
  cursor?: string;
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
  getAreaDetail(input: { slug: string }): Promise<OperationResult<AreaDetail>>;
  createArea(input: CreateAreaInput): Promise<OperationResult<AreaSummary>>;
  updateArea(input: UpdateAreaInput): Promise<OperationResult<AreaSummary>>;
  removeArea(input: {
    areaId: AreaId;
  }): Promise<OperationResult<CommandAcknowledgement>>;

  /* Threads */
  listOpenThreads(): Promise<OperationResult<Thread[]>>;
  getThreadDetail(input: {
    slug: string;
  }): Promise<OperationResult<ThreadDetail>>;
  createThread(input: CreateThreadInput): Promise<OperationResult<Thread>>;
  updateThread(input: UpdateThreadInput): Promise<OperationResult<Thread>>;
  removeThread(input: {
    threadId: ThreadId;
  }): Promise<OperationResult<CommandAcknowledgement>>;
  replaceUpNext(input: {
    threadId: ThreadId;
    moves: string[];
  }): Promise<OperationResult<Thread>>;
  completeNextMove(
    input: CompleteNextMoveInput,
  ): Promise<OperationResult<CompleteNextMoveOutput>>;

  /* Activity Log */
  getThreadActivityPage(
    input: { threadId: ThreadId } & PageRequest,
  ): Promise<OperationResult<ActivityLogPage>>;

  /* Standalone Notes */
  listOpenNotes(): Promise<OperationResult<Note[]>>;
  getDoneNotePage(input: PageRequest): Promise<OperationResult<NotePage>>;
  countOpenNotes(): Promise<OperationResult<number>>;
  createNote(input: {
    body: string;
    attentionDate?: number;
  }): Promise<OperationResult<Note>>;
  updateNoteBody(input: {
    noteId: NoteId;
    body: string;
  }): Promise<OperationResult<Note>>;
  updateNoteAttentionDate(input: {
    noteId: NoteId;
    attentionDate: Clearable<number>;
  }): Promise<OperationResult<Note>>;
  markNoteDone(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  markNoteOpen(input: { noteId: NoteId }): Promise<OperationResult<Note>>;
  removeNote(input: {
    noteId: NoteId;
  }): Promise<OperationResult<CommandAcknowledgement>>;

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
