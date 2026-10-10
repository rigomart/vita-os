import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ApplicationClient,
  ApplicationError,
  AreaId,
  AreaSummary,
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  Page,
  TaskId,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";
import type { ThreadUpdateDecision } from "@vita-os/core";

import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { commandAcknowledged } from "@vita-os/contracts";
import {
  clearedToAbsent,
  ConflictError,
  decideAddNoteToThread,
  decideAddTask,
  decideCompleteTask,
  decideEditTask,
  decideFocusTask,
  decideRemoveTask,
  decideSetTaskDate,
  decideSetTaskRepeat,
  decideSkipTask,
  decideThreadUpdate,
  generateSlug,
  matchesNoteSearch,
  newRecordId,
  noteSearchTerms,
  requireNonBlankText,
  requireTaskId,
  requireTaskText,
  requireTimeZone,
  slugify,
  validateAreaName,
  ValidationError,
} from "@vita-os/core";

/**
 * The whole application, held in memory, for the lab.
 *
 * It answers every operation the way the API does, by the same `@vita-os/core`
 * rules, so the real screens behave as they do against D1: Tasks complete into
 * the Activity Log, Notes join Threads, resolving drops Tasks. What it leaves
 * out is everything about storage: ownership (there is one person), races and
 * revisions, and persistence (a reload starts the scenario again).
 *
 * Values cross it as JSON, as they cross HTTP: inputs lose their `undefined`
 * keys and results are fresh copies the cache can hold without aliasing. Its
 * time is the product's `clock`, so a clock the lab sets is the server's too.
 */
export function createInMemoryApplicationClient(
  options: { latencyMs?: () => number } = {},
): ApplicationClient {
  const areas: AreaSummary[] = [];
  const threads: Thread[] = [];
  const activity: (ActivityLogEntry & { threadId: ThreadId })[] = [];
  const notes: Note[] = [];
  const threadNotes: (ThreadNote & { threadId: ThreadId })[] = [];

  const findArea = (areaId: AreaId) =>
    areas.find((area) => area._id === areaId);
  const findThread = (threadId: ThreadId) =>
    threads.find((thread) => thread._id === threadId);
  const findNote = (noteId: NoteId) =>
    notes.find((note) => note._id === noteId);
  const findThreadNote = (threadNoteId: ThreadNoteId) =>
    threadNotes.find((note) => note._id === threadNoteId);

  /**
   * Write a decided change: the patch, the Activity Log it earned, and the
   * activity stamp. `stamp` moves the stamp even when nothing is logged, as
   * capturing into a Thread does; `content: null` stamps without a summary.
   */
  function write(
    thread: Thread,
    { patch, logs }: ThreadUpdateDecision,
    stamp?: { content: null },
  ): Thread {
    const now = clock.now();
    const record = thread as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete record[key];
      else record[key] = value;
    }
    for (const log of logs) {
      activity.push({
        _id: newRecordId() as ActivityLogEntryId,
        threadId: thread._id,
        type: log.type,
        content: log.content,
        ...(log.previousValue === undefined
          ? {}
          : { previousValue: log.previousValue }),
        ...(log.newValue === undefined ? {} : { newValue: log.newValue }),
        createdAt: now,
      });
    }
    const content = stamp === undefined ? logs.at(-1)?.content : undefined;
    if (logs.length > 0 || stamp !== undefined) {
      thread.lastActivityAt = now;
      if (content === undefined) delete thread.lastActivityContent;
      else thread.lastActivityContent = content;
    }
    return thread;
  }

  /** Decide a Task command against the Thread as it stands, then write it. */
  function changeTasks(
    threadId: ThreadId,
    decide: (thread: Thread) => ThreadUpdateDecision | null,
  ): Thread {
    const thread = requireThread(threadId);
    const decision = decide(thread);
    if (decision === null) throw refusal(tasksChanged);
    if (Object.keys(decision.patch).length === 0 && decision.logs.length === 0)
      return thread;
    return write(thread, decision);
  }

  function requireThread(threadId: ThreadId): Thread {
    const thread = findThread(threadId);
    if (thread === undefined) throw refusal(notFound("Thread"));
    return thread;
  }

  function insertThread(input: {
    title: string;
    slug: string;
    summary?: string;
    areaId?: AreaId;
  }): Thread {
    if (input.areaId !== undefined && findArea(input.areaId) === undefined) {
      throw refusal(notFound("Area"));
    }
    const thread: Thread = {
      _id: newRecordId() as ThreadId,
      title: input.title,
      slug: input.slug,
      ...(input.summary === undefined ? {} : { summary: input.summary }),
      ...(input.areaId === undefined ? {} : { areaId: input.areaId }),
      order: nextOrder(threads),
      state: "open",
      createdAt: clock.now(),
    };
    threads.push(thread);
    return thread;
  }

  /** Copy a Standalone Note into the Thread as a Thread Note, and drop it. */
  function moveNoteInto(note: Note, thread: Thread): NoteAddedToThread {
    const threadNote: ThreadNote = {
      _id: newRecordId() as ThreadNoteId,
      body: note.body,
      state: "open",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt ?? note.createdAt,
    };
    threadNotes.push({ ...threadNote, threadId: thread._id });
    notes.splice(notes.indexOf(note), 1);
    return { thread, threadNote };
  }

  function requireOpenNote(noteId: NoteId): Note {
    const note = findNote(noteId);
    if (note === undefined || note.state !== "open") {
      throw refusal(notFound("Note"));
    }
    return note;
  }

  function insertThreadNote(
    threadId: ThreadId,
    body: string,
    id: ThreadNoteId = newRecordId() as ThreadNoteId,
  ): ThreadNote {
    if (findThreadNote(id) !== undefined) throw refusal(changeConflict);
    const now = clock.now();
    const note: ThreadNote = {
      _id: id,
      body,
      state: "open",
      createdAt: now,
      updatedAt: now,
    };
    threadNotes.push({ ...note, threadId });
    return note;
  }

  function threadNotesOf(threadId: ThreadId, state: Note["state"]) {
    return threadNotes
      .filter((note) => note.threadId === threadId && note.state === state)
      .map(({ threadId: _, ...note }) => note);
  }

  function editNote<T extends Note | ThreadNote>(
    note: T | undefined,
    noun: string,
    change: (note: T) => void,
  ): T {
    if (note === undefined) throw refusal(notFound(noun));
    change(note);
    return note;
  }

  const operations: ApplicationClient = {
    /* Areas */
    async listAreas() {
      return ok(byOrder(areas));
    },

    async createArea(input) {
      const name = validateAreaName(input.name);
      const existing = areas.find(
        (area) => slugify(area.name) === slugify(name),
      );
      if (existing !== undefined) return ok(existing);
      const area: AreaSummary = {
        _id: newRecordId() as AreaId,
        name,
        slug: generateSlug(name),
        icon: input.icon,
        order: nextOrder(areas),
        createdAt: clock.now(),
      };
      areas.push(area);
      return ok(area);
    },

    async updateArea({ areaId, ...requested }) {
      const area = findArea(areaId);
      if (area === undefined) return fail(notFound("Area"));
      if (requested.name !== undefined) {
        const name = validateAreaName(requested.name);
        if (name !== area.name) area.slug = generateSlug(name);
        area.name = name;
      }
      if (requested.icon !== undefined) area.icon = requested.icon;
      return ok(area);
    },

    async reorderAreas({ areaIds }) {
      const requested = new Set(areaIds);
      if (
        requested.size !== areaIds.length ||
        requested.size !== areas.length ||
        areas.some((area) => !requested.has(area._id))
      ) {
        return fail({
          code: "conflict",
          message: "The Area order must name every Area exactly once.",
          retryable: false,
        });
      }
      areaIds.forEach((areaId, index) => {
        findArea(areaId)!.order = index;
      });
      return ok(byOrder(areas));
    },

    async removeArea({ areaId }) {
      const area = findArea(areaId);
      if (area === undefined) return fail(notFound("Area"));
      for (const thread of threads) {
        if (thread.areaId === areaId) delete thread.areaId;
      }
      areas.splice(areas.indexOf(area), 1);
      return ok(commandAcknowledged);
    },

    /* Threads */
    async listOpenThreads() {
      return ok(byOrder(threads.filter((thread) => thread.state === "open")));
    },

    async listResolvedThreads() {
      const resolvedAt = (thread: Thread) =>
        Math.max(
          -Infinity,
          ...activity
            .filter(
              (entry) =>
                entry.threadId === thread._id &&
                entry.type === "state_change" &&
                entry.newValue === "resolved",
            )
            .map((entry) => entry.createdAt),
        );
      return ok(
        threads
          .filter((thread) => thread.state === "resolved")
          .sort(
            (a, b) =>
              resolvedAt(b) - resolvedAt(a) || a._id.localeCompare(b._id),
          ),
      );
    },

    async getThreadDetail({ slug }) {
      const thread = threads.find((candidate) => candidate.slug === slug);
      if (thread === undefined) return fail(notFound("Thread"));
      const area =
        thread.areaId === undefined ? undefined : findArea(thread.areaId);
      return ok({ thread, ...(area === undefined ? {} : { area }) });
    },

    async createThread(input) {
      const title = requireNonBlankText(input.title, "Thread title");
      return ok(insertThread({ ...input, title, slug: generateSlug(title) }));
    },

    async updateThread({ threadId, resolutionNote, ...requested }) {
      const thread = requireThread(threadId);
      const title =
        requested.title === undefined
          ? undefined
          : requireNonBlankText(requested.title, "Thread title");
      const patch = clearedToAbsent({
        ...requested,
        ...(title === undefined ? {} : { title }),
      });
      // A retitled Thread gets a new slug; the old one stops resolving.
      const rename =
        title !== undefined && title !== thread.title
          ? { slug: generateSlug(title) }
          : {};
      const areaNames: { from?: string; to?: string } = {};
      if (Object.hasOwn(patch, "areaId") && patch.areaId !== thread.areaId) {
        if (patch.areaId !== undefined) {
          const destination = findArea(patch.areaId);
          if (destination === undefined) return fail(notFound("Area"));
          areaNames.to = destination.name;
        }
        if (thread.areaId !== undefined) {
          const origin = findArea(thread.areaId);
          if (origin !== undefined) areaNames.from = origin.name;
        }
      }
      const decision = decideThreadUpdate({
        thread,
        patch: { ...patch, ...rename },
        ...(resolutionNote === undefined ? {} : { resolutionNote }),
        areaNames,
      });
      if (
        Object.keys(decision.patch).length === 0 &&
        decision.logs.length === 0
      )
        return ok(thread);
      return ok(write(thread, decision));
    },

    async removeThread({ threadId }) {
      const thread = requireThread(threadId);
      threads.splice(threads.indexOf(thread), 1);
      removeWhere(activity, (entry) => entry.threadId === threadId);
      removeWhere(threadNotes, (note) => note.threadId === threadId);
      return ok(commandAcknowledged);
    },

    /* Tasks */
    async addTask(input) {
      const task = {
        _id: requireTaskId(input.taskId),
        text: requireTaskText(input.text),
        ...(input.date === undefined ? {} : { date: input.date }),
      };
      return ok(
        changeTasks(input.threadId, (thread) => decideAddTask(thread, task)),
      );
    },

    async editTask(input) {
      const text = requireTaskText(input.text);
      return ok(
        changeTasks(input.threadId, (thread) =>
          decideEditTask(thread, input.taskId, text),
        ),
      );
    },

    async removeTask(input) {
      return ok(
        changeTasks(input.threadId, (thread) =>
          decideRemoveTask(thread, input.taskId),
        ),
      );
    },

    async completeTask(input) {
      const note =
        input.note === undefined
          ? undefined
          : {
              id: requireTaskId(input.note.id) as string as ThreadNoteId,
              body: requireNonBlankText(input.note.body, "Thread note body"),
            };
      if (note !== undefined && findThreadNote(note.id) !== undefined) {
        return fail(changeConflict);
      }
      const thread = requireThread(input.threadId);
      const task = thread.tasks?.find((task) => task._id === input.taskId);
      if (
        task === undefined ||
        (task.date ?? null) !== input.expectedOccurrence
      )
        return fail(tasksChanged);
      if (input.timeZone !== undefined) requireTimeZone(input.timeZone);
      const decision = decideCompleteTask(thread, input.taskId, {
        timeZone: input.timeZone,
        now: clock.now(),
      });
      if (decision === null) return fail(tasksChanged);
      // A completion that captures a Note stamps the Thread without a summary.
      write(
        thread,
        decision,
        note === undefined ? undefined : { content: null },
      );
      if (note !== undefined) insertThreadNote(thread._id, note.body, note.id);
      return ok(thread);
    },

    async focusTask(input) {
      return ok(
        changeTasks(input.threadId, (thread) =>
          decideFocusTask(thread, input.taskId),
        ),
      );
    },

    async setTaskDate(input) {
      return ok(
        changeTasks(input.threadId, (thread) =>
          decideSetTaskDate(thread, input.taskId, input.date, input.timeZone),
        ),
      );
    },

    async setTaskRepeat(input) {
      return ok(
        changeTasks(input.threadId, (thread) =>
          decideSetTaskRepeat(
            thread,
            input.taskId,
            input.repeat,
            input.timeZone,
          ),
        ),
      );
    },

    async skipTask(input) {
      return ok(
        changeTasks(input.threadId, (thread) => {
          const task = thread.tasks?.find((task) => task._id === input.taskId);
          if (task === undefined || task.date !== input.expectedOccurrence)
            return null;
          return decideSkipTask(thread, input.taskId, {
            timeZone: input.timeZone,
            now: clock.now(),
          });
        }),
      );
    },

    /* Activity Log */
    async getThreadActivityPage({ threadId, ...page }) {
      requireThread(threadId);
      return ok(
        paginate(
          activity
            .filter((entry) => entry.threadId === threadId)
            .map(({ threadId: _, ...entry }) => entry)
            .sort(newestFirst((entry) => entry.createdAt)),
          page,
        ),
      );
    },

    /* Standalone Notes */
    async listOpenNotes() {
      return ok(
        notes
          .filter((note) => note.state === "open")
          .sort(newestFirst((note) => note.createdAt)),
      );
    },

    async getDoneNotePage({ query, ...page }) {
      noteSearchTerms(query ?? "");
      return ok(
        paginate(
          notes
            .filter(
              (note) =>
                note.state === "done" &&
                matchesNoteSearch(note.body, query ?? ""),
            )
            .sort(newestFirst((note) => note.completedAt ?? 0)),
          page,
        ),
      );
    },

    async countOpenNotes() {
      return ok(notes.filter((note) => note.state === "open").length);
    },

    async createNote(input) {
      const now = clock.now();
      const note: Note = {
        _id: newRecordId() as NoteId,
        body: requireNonBlankText(input.body, "Note body"),
        ...(input.followUp === undefined ? {} : { followUp: input.followUp }),
        state: "open",
        createdAt: now,
        updatedAt: now,
      };
      notes.push(note);
      return ok(note);
    },

    async updateNoteBody({ noteId, body }) {
      const text = requireNonBlankText(body, "Note body");
      return ok(
        editNote(findNote(noteId), "Note", (note) => {
          note.body = text;
          note.updatedAt = clock.now();
        }),
      );
    },

    async updateNoteFollowUp({ noteId, followUp }) {
      return ok(
        editNote(findNote(noteId), "Note", (note) => {
          if (followUp === null) delete note.followUp;
          else note.followUp = followUp;
          note.updatedAt = clock.now();
        }),
      );
    },

    async markNoteDone({ noteId }) {
      return ok(
        editNote(findNote(noteId), "Note", (note) => {
          const now = clock.now();
          note.state = "done";
          note.completedAt = now;
          note.updatedAt = now;
        }),
      );
    },

    async markNoteOpen({ noteId }) {
      return ok(
        editNote(findNote(noteId), "Note", (note) => {
          note.state = "open";
          delete note.completedAt;
          note.updatedAt = clock.now();
        }),
      );
    },

    async removeNote({ noteId }) {
      const note = findNote(noteId);
      if (note === undefined) return fail(notFound("Note"));
      notes.splice(notes.indexOf(note), 1);
      return ok(commandAcknowledged);
    },

    async addNoteToThread(input) {
      const note = requireOpenNote(input.noteId);
      const thread = findThread(input.threadId);
      if (thread === undefined || thread.state !== "open")
        return fail(notFound("Thread"));
      const decision = decideAddNoteToThread(
        thread,
        note,
        taskIdFor(input.taskId),
      );
      write(thread, decision, { content: null });
      return ok(moveNoteInto(note, thread));
    },

    async createThreadFromNote(input) {
      const title = requireNonBlankText(input.title, "Thread title");
      const note = requireOpenNote(input.noteId);
      const slug = generateSlug(title);
      const decision = decideAddNoteToThread(
        { title, slug, state: "open" },
        note,
        taskIdFor(input.taskId),
      );
      const thread = insertThread({
        title,
        slug,
        ...(input.areaId === undefined ? {} : { areaId: input.areaId }),
      });
      write(thread, decision, { content: null });
      return ok(moveNoteInto(note, thread));
    },

    /* Thread Notes */
    async listOpenThreadNotes({ threadId }) {
      requireThread(threadId);
      return ok(
        threadNotesOf(threadId, "open").sort(
          newestFirst((note) => note.createdAt),
        ),
      );
    },

    async getDoneThreadNotePage({ threadId, ...page }) {
      requireThread(threadId);
      return ok(
        paginate(
          threadNotesOf(threadId, "done").sort(
            newestFirst((note) => note.completedAt ?? 0),
          ),
          page,
        ),
      );
    },

    async createThreadNote({ threadId, body }) {
      const text = requireNonBlankText(body, "Thread note body");
      const thread = requireThread(threadId);
      const note = insertThreadNote(threadId, text);
      thread.lastActivityAt = note.createdAt;
      delete thread.lastActivityContent;
      return ok(note);
    },

    async updateThreadNoteBody({ threadNoteId, body }) {
      const text = requireNonBlankText(body, "Thread note body");
      return ok(
        withoutThreadId(
          editNote(findThreadNote(threadNoteId), "Thread note", (note) => {
            note.body = text;
            note.updatedAt = clock.now();
          }),
        ),
      );
    },

    async markThreadNoteDone({ threadNoteId }) {
      return ok(
        withoutThreadId(
          editNote(findThreadNote(threadNoteId), "Thread note", (note) => {
            note.state = "done";
            note.completedAt = clock.now();
          }),
        ),
      );
    },

    async markThreadNoteOpen({ threadNoteId }) {
      return ok(
        withoutThreadId(
          editNote(findThreadNote(threadNoteId), "Thread note", (note) => {
            note.state = "open";
            delete note.completedAt;
          }),
        ),
      );
    },

    async removeThreadNote({ threadNoteId }) {
      const note = findThreadNote(threadNoteId);
      if (note === undefined) return fail(notFound("Thread note"));
      threadNotes.splice(threadNotes.indexOf(note), 1);
      return ok(commandAcknowledged);
    },
  };

  return asTransport(operations, options.latencyMs ?? (() => 0));
}

/**
 * Give every operation what the HTTP client gives it: JSON on the way in and
 * out, the configured latency, and core's refusals as application errors.
 */
function asTransport(
  operations: ApplicationClient,
  latencyMs: () => number,
): ApplicationClient {
  const client: Record<string, unknown> = {};
  for (const [name, operation] of Object.entries(operations)) {
    client[name] = async (input?: unknown) => {
      const delay = latencyMs();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const result = await (
          operation as (input: unknown) => Promise<OperationResult<unknown>>
        )(input === undefined ? undefined : asJson(input));
        return result.ok ? ok(asJson(result.value)) : result;
      } catch (error) {
        return fail(toApplicationError(error));
      }
    };
  }
  return client as unknown as ApplicationClient;
}

function toApplicationError(error: unknown): ApplicationError {
  if (error instanceof Refusal) return error.error;
  if (error instanceof ValidationError) {
    return { code: "validation", message: error.message, retryable: false };
  }
  if (error instanceof ConflictError) {
    return { code: "conflict", message: error.message, retryable: false };
  }
  // A bug in the lab, not a refusal: keep it loud.
  console.error("In-memory application client failed", error);
  return {
    code: "unexpected",
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
}

/** An application error thrown from deep inside an operation. */
class Refusal extends Error {
  readonly error: ApplicationError;

  constructor(error: ApplicationError) {
    super(error.message);
    this.error = error;
  }
}

function refusal(error: ApplicationError): Refusal {
  return new Refusal(error);
}

function notFound(noun: string): ApplicationError {
  return { code: "not_found", message: `${noun} not found.`, retryable: false };
}

const tasksChanged: ApplicationError = {
  code: "conflict",
  message: "The Thread's Tasks have changed.",
  retryable: false,
};

const changeConflict: ApplicationError = {
  code: "conflict",
  message: "The record changed while this request was in flight.",
  retryable: true,
};

function ok<T>(value: T): OperationResult<T> {
  return { ok: true, value };
}

function fail<T>(error: ApplicationError): OperationResult<T> {
  return { ok: false, error };
}

function asJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutThreadId({
  threadId: _,
  ...note
}: ThreadNote & { threadId: ThreadId }): ThreadNote {
  return note;
}

function taskIdFor(requested: TaskId | undefined): TaskId {
  return requested === undefined
    ? (newRecordId() as TaskId)
    : requireTaskId(requested);
}

function nextOrder(records: readonly { order: number }[]): number {
  return Math.max(-1, ...records.map((record) => record.order)) + 1;
}

function byOrder<T extends { order: number; _id: string }>(
  records: readonly T[],
): T[] {
  return [...records].sort(
    (a, b) => a.order - b.order || a._id.localeCompare(b._id),
  );
}

/** Newest first, ties broken by ID, which sorts by creation time. */
function newestFirst<T extends { _id: string }>(at: (record: T) => number) {
  return (a: T, b: T) => at(b) - at(a) || b._id.localeCompare(a._id);
}

function removeWhere<T>(records: T[], matches: (record: T) => boolean) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (matches(records[index]!)) records.splice(index, 1);
  }
}

/** The cursor is the ID of the last entry handed out. */
function paginate<T extends { _id: string }>(
  sorted: T[],
  { limit, cursor }: { limit: number; cursor?: string },
): Page<T> {
  const start =
    cursor === undefined
      ? 0
      : sorted.findIndex((entry) => entry._id === cursor) + 1;
  const entries = sorted.slice(start, start + limit);
  const last = entries.at(-1);
  return start + limit < sorted.length && last !== undefined
    ? { entries, nextCursor: last._id }
    : { entries };
}
