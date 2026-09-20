import type {
  ActivityLogPage,
  AreaDetail,
  AreaSummary,
  CommandAcknowledgement,
  CompleteNextMoveOutput,
  CreateAreaInput,
  CreateThreadInput,
  Note,
  NotePage,
  PageRequest,
  Thread,
  ThreadDetail,
  ThreadNote,
  ThreadNotePage,
  UpdateAreaInput,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type {
  AreaId,
  NoteId,
  ThreadId,
  ThreadNoteId,
} from "@vita-os/contracts";

/**
 * What storage can do, named after Vita OS operations.
 *
 * Each capability is one complete workflow, so a rule that must hold across
 * several records — a Thread change and the Activity Log it earns — cannot be
 * split across two public calls and lose its atomicity. There is deliberately no
 * generic "update row" or "find by id" here.
 *
 * Every operation receives the authenticated actor explicitly and scopes its own
 * reads and writes by it. A record that does not exist and a record owned by
 * somebody else produce the same `not_found` outcome.
 */

/** The record kinds a read or write can fail to find. */
export type StoreSubject = "area" | "thread" | "note" | "thread_note";

export type StoreResult<T> =
  | { status: "ok"; value: T }
  | { status: "not_found"; subject?: StoreSubject }
  | { status: "conflict" };

export function found<T>(value: T): StoreResult<T> {
  return { status: "ok", value };
}

export const notFound = { status: "not_found" } as const;

/**
 * Not found, and which kind of record was looked for.
 *
 * Naming the kind keeps a message accurate when one workflow touches two kinds —
 * moving a Thread into an Area, say — without revealing anything about whether
 * the record exists for somebody else. Every one of these is still a plain 404.
 */
export function missing(subject: StoreSubject): StoreResult<never> {
  return { status: "not_found", subject };
}
export const conflicted = { status: "conflict" } as const;

export type Actored<T = unknown> = T & { actorId: string };

export interface AreaStore {
  listAreas(input: Actored): Promise<AreaSummary[]>;
  getAreaDetail(
    input: Actored<{ slug: string }>,
  ): Promise<StoreResult<AreaDetail>>;
  createArea(
    input: Actored<CreateAreaInput>,
  ): Promise<StoreResult<AreaSummary>>;
  updateArea(
    input: Actored<UpdateAreaInput>,
  ): Promise<StoreResult<AreaSummary>>;
  removeArea(
    input: Actored<{ areaId: AreaId }>,
  ): Promise<StoreResult<CommandAcknowledgement>>;
}

export interface ThreadStore {
  listOpenThreads(input: Actored): Promise<Thread[]>;
  getThreadDetail(
    input: Actored<{ slug: string }>,
  ): Promise<StoreResult<ThreadDetail>>;
  createThread(input: Actored<CreateThreadInput>): Promise<StoreResult<Thread>>;
  updateThread(input: Actored<UpdateThreadInput>): Promise<StoreResult<Thread>>;
  removeThread(
    input: Actored<{ threadId: ThreadId }>,
  ): Promise<StoreResult<CommandAcknowledgement>>;
  replaceUpNext(
    input: Actored<{ threadId: ThreadId; moves: string[] }>,
  ): Promise<StoreResult<Thread>>;
  completeNextMove(
    input: Actored<{
      threadId: ThreadId;
      expectedNextMove: string | null;
      expectedRevision: number;
    }>,
  ): Promise<StoreResult<CompleteNextMoveOutput>>;
  getThreadActivityPage(
    input: Actored<{ threadId: ThreadId } & PageRequest>,
  ): Promise<StoreResult<ActivityLogPage>>;
}

export interface NoteStore {
  listOpenNotes(input: Actored): Promise<Note[]>;
  countOpenNotes(input: Actored): Promise<number>;
  getDoneNotePage(input: Actored<PageRequest>): Promise<StoreResult<NotePage>>;
  createNote(
    input: Actored<{ body: string; when?: number }>,
  ): Promise<StoreResult<Note>>;
  updateNoteBody(
    input: Actored<{ noteId: NoteId; body: string }>,
  ): Promise<StoreResult<Note>>;
  updateNoteAttentionDate(
    input: Actored<{ noteId: NoteId; when: number | null }>,
  ): Promise<StoreResult<Note>>;
  markNoteDone(input: Actored<{ noteId: NoteId }>): Promise<StoreResult<Note>>;
  markNoteOpen(input: Actored<{ noteId: NoteId }>): Promise<StoreResult<Note>>;
  removeNote(
    input: Actored<{ noteId: NoteId }>,
  ): Promise<StoreResult<CommandAcknowledgement>>;
}

export interface ThreadNoteStore {
  listOpenThreadNotes(
    input: Actored<{ threadId: ThreadId }>,
  ): Promise<StoreResult<ThreadNote[]>>;
  getDoneThreadNotePage(
    input: Actored<{ threadId: ThreadId } & PageRequest>,
  ): Promise<StoreResult<ThreadNotePage>>;
  createThreadNote(
    input: Actored<{ threadId: ThreadId; body: string }>,
  ): Promise<StoreResult<ThreadNote>>;
  updateThreadNoteBody(
    input: Actored<{ threadNoteId: ThreadNoteId; body: string }>,
  ): Promise<StoreResult<ThreadNote>>;
  markThreadNoteDone(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<ThreadNote>>;
  markThreadNoteOpen(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<ThreadNote>>;
  removeThreadNote(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<CommandAcknowledgement>>;
}

/** Everything the Worker's routes are allowed to ask of storage. */
export interface VitaStore {
  areas: AreaStore;
  threads: ThreadStore;
  notes: NoteStore;
  threadNotes: ThreadNoteStore;
}

/**
 * Time and identity, injected.
 *
 * Integration tests force a real primary-key collision and freeze time through
 * these rather than through a test-only branch inside a store.
 */
export interface StoreClock {
  now(): number;
  newId(): string;
}
