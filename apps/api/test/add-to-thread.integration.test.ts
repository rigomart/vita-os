import type {
  ActivityLogPage,
  AreaSummary,
  Note,
  NoteAddedToThread,
  OperationResult,
  TaskId,
  Thread,
  ThreadDetail,
  ThreadNote,
} from "@vita-os/contracts";

import { Result } from "better-result";
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Operation } from "../src/platform/operation";
import type { RequestScope } from "../src/platform/request-scope";
import type { Session } from "./sessions";

import * as adding from "../src/features/add-to-thread/operations";
import * as notes from "../src/features/notes/operations";
import * as threads from "../src/features/threads/operations";
import { toRefusal } from "../src/platform/http/errors";
import { call, createSession, expectError, succeed } from "./sessions";

/**
 * Adding a Standalone Note to a Thread, through the Worker the way the browser
 * does it: the Note becomes a Thread Note with its creation time, a dated Note
 * also adds a dated Task, and a refused request writes nothing anywhere.
 */

const may20 = new Date("2030-05-20T00:00:00").getTime();
const jun1 = new Date("2030-06-01T15:30:00").getTime();

const noteNotFound = {
  status: 404,
  code: "not_found",
  message: "Note not found.",
};
const threadNotFound = {
  status: 404,
  code: "not_found",
  message: "Thread not found.",
};

afterEach(() => vi.restoreAllMocks());

async function createNote(
  session: Session,
  body: string,
  followUp?: number,
): Promise<Note> {
  return succeed<Note>("/v1/notes", {
    method: "POST",
    session,
    body: { body, ...(followUp === undefined ? {} : { followUp }) },
  });
}

async function createThread(
  session: Session,
  /** A dated Task the Thread already holds. */
  taskDate?: number,
): Promise<Thread> {
  const thread = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: `Dentist ${crypto.randomUUID()}` },
  });
  if (taskDate === undefined) return thread;
  return succeed<Thread>(`/v1/threads/${thread._id}/tasks`, {
    method: "POST",
    session,
    body: {
      taskId: "existing-task",
      text: "Existing",
      date: taskDate,
    },
  });
}

function addToThread(
  session: Session,
  note: { _id: string },
  threadId: string,
) {
  return call(`/v1/notes/${note._id}/add-to-thread`, {
    method: "POST",
    session,
    body: { threadId },
  });
}

async function activityOf(session: Session, threadId: string) {
  const page = await succeed<ActivityLogPage>(
    `/v1/threads/${threadId}/activity?limit=50`,
    { session },
  );
  return page.entries;
}

/** Everything the owner has stored in the four tables adding a Note can touch. */
async function everything(session: Session) {
  const read = (table: string) =>
    env.DB.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id`)
      .bind(session.actorId)
      .all()
      .then((result) => result.results);
  return {
    notes: await read("notes"),
    threadNotes: await read("thread_notes"),
    threads: await read("threads"),
    activity: await read("activity_log_entries"),
  };
}

describe("adding a Note to a Thread", () => {
  it("makes the Note a Thread Note with its creation and edit times", async () => {
    const owner = await createSession("add-to-thread-times");
    const thread = await createThread(owner);
    const note = await createNote(owner, "Clinic opens at nine");
    const edited = await succeed<Note>(`/v1/notes/${note._id}/body`, {
      method: "PATCH",
      session: owner,
      body: { body: "Clinic opens at **nine**" },
    });

    const answer = await addToThread(owner, note, thread._id);

    expect(answer.status).toBe(200);
    const added = answer.body as NoteAddedToThread;
    expect(added.threadNote).toEqual({
      _id: expect.any(String),
      body: "Clinic opens at **nine**",
      state: "open",
      createdAt: note.createdAt,
      updatedAt: edited.updatedAt,
    });
    expect(added.threadNote._id).not.toBe(note._id);
    expect(
      await succeed<ThreadNote[]>(`/v1/threads/${thread._id}/notes`, {
        session: owner,
      }),
    ).toEqual([added.threadNote]);
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([]);
    expect(
      await succeed<{ count: number }>("/v1/notes/open-count", {
        session: owner,
      }),
    ).toEqual({ count: 0 });
  });

  it("uses the creation time as the edit time when the Note has none", async () => {
    const owner = await createSession("add-to-thread-legacy");
    const thread = await createThread(owner);
    const noteId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
       VALUES (?, ?, 'Imported', NULL, 'open', NULL, 1600000000000, NULL)`,
    )
      .bind(noteId, owner.actorId)
      .run();

    const added = (await addToThread(owner, { _id: noteId }, thread._id))
      .body as NoteAddedToThread;

    expect(added.threadNote).toMatchObject({
      createdAt: 1_600_000_000_000,
      updatedAt: 1_600_000_000_000,
    });
  });

  it("counts as Thread activity without an Activity Log entry for an undated Note", async () => {
    const owner = await createSession("add-to-thread-activity");
    const thread = await createThread(owner);
    const note = await createNote(owner, "Bring the referral");

    const added = (await addToThread(owner, note, thread._id))
      .body as NoteAddedToThread;

    expect(added.thread.lastActivityAt).toEqual(expect.any(Number));
    expect(added.thread).not.toHaveProperty("lastActivityContent");
    expect(added.thread).not.toHaveProperty("followUp");

    expect(await activityOf(owner, thread._id)).toEqual([]);
    const detail = await succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, {
      session: owner,
    });
    expect(detail.thread).toEqual(added.thread);
  });

  describe("a dated Note adds a dated Task", () => {
    it("appends a Task named by the Note's first line, dated as the Note, with no Activity Log entry", async () => {
      const owner = await createSession("add-to-thread-undated");
      const thread = await createThread(owner);
      const note = await createNote(owner, "Call back\nabout the scan", jun1);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.tasks).toEqual([
        { _id: expect.any(String), text: "Call back", date: jun1 },
      ]);
      expect(added.thread).not.toHaveProperty("focusedTaskId");
      expect(added.thread).not.toHaveProperty("followUp");
      expect(added.thread).not.toHaveProperty("lastActivityContent");
      expect(await activityOf(owner, thread._id)).toEqual([]);
      expect(
        (
          await succeed<ThreadNote[]>(`/v1/threads/${thread._id}/notes`, {
            session: owner,
          })
        ).map((threadNote) => threadNote.body),
      ).toEqual(["Call back\nabout the scan"]);
    });

    it("keeps the Thread's own Tasks first and appends the new one unfocused", async () => {
      const owner = await createSession("add-to-thread-earlier");
      const thread = await createThread(owner, jun1);
      const past = new Date("2020-01-02T09:15:00").getTime();
      const note = await createNote(owner, "Overdue", past);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.tasks).toEqual([
        { _id: "existing-task", text: "Existing", date: jun1 },
        { _id: expect.any(String), text: "Overdue", date: past },
      ]);
      expect(added.thread).not.toHaveProperty("followUp");
      expect(await activityOf(owner, thread._id)).toEqual([]);
    });

    it.each([
      ["# Dentist\nCall Monday", "Dentist"],
      ["- Bring the referral", "Bring the referral"],
      ["> 1. Quoted step", "Quoted step"],
      ["\n\n   Third line first   ", "Third line first"],
      ["###", "Follow up"],
    ])("names the Task from %j as %j", async (body, expected) => {
      const owner = await createSession("add-to-thread-first-line");
      const thread = await createThread(owner);
      const note = await createNote(owner, body, may20);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.tasks).toEqual([
        { _id: expect.any(String), text: expected, date: may20 },
      ]);
    });

    it("keeps the time of day on the Task", async () => {
      const owner = await createSession("add-to-thread-time");
      const thread = await createThread(owner);
      const note = await createNote(owner, "Call back", jun1);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(new Date(added.thread.tasks![0]!.date!).getHours()).toBe(15);
      expect(new Date(added.thread.tasks![0]!.date!).getMinutes()).toBe(30);
    });

    it("adds no Task for an undated Note, and still counts as Thread activity", async () => {
      const owner = await createSession("add-to-thread-undated-note");
      const thread = await createThread(owner, may20);
      const note = await createNote(owner, "Undated");

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.tasks).toEqual(thread.tasks);
      expect(added.thread.lastActivityAt).toEqual(expect.any(Number));
      expect(await activityOf(owner, thread._id)).toEqual([]);
    });
  });

  describe("refusals write nothing", () => {
    it("refuses another owner's Note and another owner's Thread", async () => {
      const owner = await createSession("add-to-thread-owner");
      const other = await createSession("add-to-thread-other");
      const mine = await createThread(owner);
      const theirs = await createThread(other);
      const myNote = await createNote(owner, "Mine", may20);
      const theirNote = await createNote(other, "Theirs", may20);
      const before = [await everything(owner), await everything(other)];

      expectError(await addToThread(owner, theirNote, mine._id), noteNotFound);
      expectError(await addToThread(owner, myNote, theirs._id), threadNotFound);
      expectError(await addToThread(other, myNote, theirs._id), noteNotFound);

      expect([await everything(owner), await everything(other)]).toEqual(
        before,
      );
    });

    it("refuses a resolved Thread", async () => {
      const owner = await createSession("add-to-thread-resolved");
      const thread = await createThread(owner);
      await succeed(`/v1/threads/${thread._id}`, {
        method: "PATCH",
        session: owner,
        body: { state: "resolved" },
      });
      const note = await createNote(owner, "Too late", may20);
      const before = await everything(owner);

      expectError(await addToThread(owner, note, thread._id), threadNotFound);

      expect(await everything(owner)).toEqual(before);
    });

    it("refuses a Done Note", async () => {
      const owner = await createSession("add-to-thread-done");
      const thread = await createThread(owner);
      const note = await createNote(owner, "Already done");
      await succeed(`/v1/notes/${note._id}/state`, {
        method: "PATCH",
        session: owner,
        body: { state: "done" },
      });
      const before = await everything(owner);

      expectError(await addToThread(owner, note, thread._id), noteNotFound);

      expect(await everything(owner)).toEqual(before);
    });

    it("does not take a Thread Note's id for a Note", async () => {
      const owner = await createSession("add-to-thread-thread-note");
      const thread = await createThread(owner);
      const other = await createThread(owner);
      const threadNote = await succeed<ThreadNote>(
        `/v1/threads/${thread._id}/notes`,
        { method: "POST", session: owner, body: { body: "Inside" } },
      );
      const before = await everything(owner);

      expectError(
        await addToThread(owner, threadNote, other._id),
        noteNotFound,
      );

      expect(await everything(owner)).toEqual(before);
    });

    it("refuses an empty or extra request body", async () => {
      const owner = await createSession("add-to-thread-invalid");
      const note = await createNote(owner, "Valid");
      for (const body of [{}, { threadId: "" }, { threadId: "x", extra: 1 }]) {
        expectError(
          await call(`/v1/notes/${note._id}/add-to-thread`, {
            method: "POST",
            session: owner,
            body,
          }),
          { status: 400, code: "validation" },
        );
      }
    });
  });
});

describe("starting a Thread from a Note", () => {
  function newThread(
    session: Session,
    note: { _id: string },
    body: Record<string, unknown>,
  ) {
    return call(`/v1/notes/${note._id}/new-thread`, {
      method: "POST",
      session,
      body,
    });
  }

  it("creates the Thread with the Note as its first Thread Note and a dated Task", async () => {
    const owner = await createSession("new-thread-from-note");
    const area = await succeed<AreaSummary>("/v1/areas", {
      method: "POST",
      session: owner,
      body: { name: "Health", icon: "HeartPulse" },
    });
    const note = await createNote(owner, "# Dentist\nCall Monday", jun1);

    const answer = await newThread(owner, note, {
      title: "  Dentist  ",
      areaId: area._id,
    });

    expect(answer.status).toBe(201);
    const added = answer.body as NoteAddedToThread;
    expect(added.thread).toMatchObject({
      title: "Dentist",
      areaId: area._id,
      state: "open",
      tasks: [{ _id: expect.any(String), text: "Dentist", date: jun1 }],
      lastActivityAt: expect.any(Number),
    });
    expect(added.threadNote).toMatchObject({
      body: "# Dentist\nCall Monday",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
    const detail = await succeed<ThreadDetail>(
      `/v1/threads/${added.thread.slug}`,
      { session: owner },
    );
    expect(detail.thread).toEqual(added.thread);
    expect(await activityOf(owner, added.thread._id)).toEqual([]);
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([]);
  });

  it("names the Task Follow up when the Note's first line is only markers", async () => {
    const owner = await createSession("new-thread-fallback");
    const note = await createNote(owner, "## \n- ", may20);

    const added = (await newThread(owner, note, { title: "Markers" }))
      .body as NoteAddedToThread;

    expect(added.thread.tasks).toEqual([
      { _id: expect.any(String), text: "Follow up", date: may20 },
    ]);
  });

  it("starts an undated Thread from an undated Note with no Activity Log", async () => {
    const owner = await createSession("new-thread-undated");
    const note = await createNote(owner, "Just a thought");

    const added = (await newThread(owner, note, { title: "Thought" }))
      .body as NoteAddedToThread;

    expect(added.thread).not.toHaveProperty("tasks");
    expect(added.thread).not.toHaveProperty("followUp");
    expect(added.thread).not.toHaveProperty("areaId");
    expect(await activityOf(owner, added.thread._id)).toEqual([]);
  });

  it("refuses another owner's Area, a missing Note, and a blank title, writing nothing", async () => {
    const owner = await createSession("new-thread-refusals");
    const other = await createSession("new-thread-refusals-other");
    const theirArea = await succeed<AreaSummary>("/v1/areas", {
      method: "POST",
      session: other,
      body: { name: "Theirs", icon: "Home" },
    });
    const note = await createNote(owner, "Mine", may20);
    const theirNote = await createNote(other, "Theirs");
    const before = await everything(owner);

    expectError(
      await newThread(owner, note, { title: "T", areaId: theirArea._id }),
      { status: 404, code: "not_found", message: "Area not found." },
    );
    expectError(
      await newThread(owner, theirNote, { title: "T" }),
      noteNotFound,
    );
    expectError(await newThread(owner, note, { title: "  " }), {
      status: 400,
      code: "validation",
    });

    expect(await everything(owner)).toEqual(before);
  });
});

describe("contention", () => {
  const clock = { now: () => Date.now(), newId: () => crypto.randomUUID() };
  async function run<T>(operation: Operation<T>): Promise<OperationResult<T>> {
    const result = await operation;
    return Result.isOk(result)
      ? { ok: true, value: result.value }
      : { ok: false, error: toRefusal(result.error).error };
  }
  function value<T>(result: OperationResult<T>): T {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
  const scopeFor = (): RequestScope => ({
    db: env.DB,
    clock,
    actorId: crypto.randomUUID(),
  });

  it("decides again when the Thread changes under the decision", async () => {
    const scope = scopeFor();
    const thread = value(
      await run(threads.createThread(scope, { title: "Racing" })),
    );
    const note = value(
      await run(notes.createNote(scope, { body: "Dated", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      // Another device changes the Thread while this request decides.
      value(
        await run(
          threads.updateThread(scope, {
            threadId: thread._id,
            summary: "Moved on",
          }),
        ),
      );
      return batch(statements);
    });

    const added = value(
      await run(
        adding.addNoteToThread(scope, {
          noteId: note._id,
          threadId: thread._id,
        }),
      ),
    );

    // The lost batch wrote nothing; the retry added the Task exactly once.
    expect(added.thread.tasks).toEqual([
      { _id: expect.any(String), text: "Dated", date: jun1 },
    ]);
    expect(added.thread.summary).toBe("Moved on");
    const copies = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM thread_notes WHERE thread_id = ?",
    )
      .bind(thread._id)
      .first<{ n: number }>();
    expect(copies?.n).toBe(1);
  });

  it("preserves a Task edit and a dated Note conversion when their writes race", async () => {
    const scope = scopeFor();
    const created = value(
      await run(threads.createThread(scope, { title: "Both actions" })),
    );
    const thread = value(
      await run(
        threads.addTask(scope, {
          threadId: created._id,
          taskId: "existing" as TaskId,
          text: "Old text",
        }),
      ),
    );
    const note = value(
      await run(notes.createNote(scope, { body: "Converted", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(
        await run(
          adding.addNoteToThread(scope, {
            noteId: note._id,
            threadId: thread._id,
            taskId: "converted" as TaskId,
          }),
        ),
      );
      return batch(statements);
    });
    const edited = value(
      await run(
        threads.editTask(scope, {
          threadId: thread._id,
          taskId: "existing" as TaskId,
          text: "New text",
        }),
      ),
    );
    expect(edited.tasks).toEqual([
      { _id: "existing", text: "New text" },
      { _id: "converted", text: "Converted", date: jun1 },
    ]);
    const copied = await env.DB.prepare(
      "SELECT body FROM thread_notes WHERE thread_id = ?",
    )
      .bind(thread._id)
      .all<{ body: string }>();
    expect(copied.results).toEqual([{ body: "Converted" }]);
    expect(
      await env.DB.prepare("SELECT id FROM notes WHERE id = ?")
        .bind(note._id)
        .first(),
    ).toBeNull();
  });

  it("writes nothing when the Note is completed under the decision", async () => {
    const scope = scopeFor();
    const thread = value(
      await run(threads.createThread(scope, { title: "Racing note" })),
    );
    const note = value(
      await run(notes.createNote(scope, { body: "Dated", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(await run(notes.markNoteDone(scope, { noteId: note._id })));
      return batch(statements);
    });

    const refused = await run(
      adding.addNoteToThread(scope, { noteId: note._id, threadId: thread._id }),
    );

    expect(refused).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "Note not found." },
    });
    const stored = await env.DB.prepare(
      `SELECT revision, moves_json, last_activity_at,
              (SELECT COUNT(*) FROM thread_notes WHERE thread_id = threads.id) AS copies,
              (SELECT COUNT(*) FROM activity_log_entries WHERE thread_id = threads.id) AS entries
       FROM threads WHERE id = ?`,
    )
      .bind(thread._id)
      .first();
    expect(stored).toEqual({
      revision: 0,
      moves_json: null,
      last_activity_at: null,
      copies: 0,
      entries: 0,
    });
  });

  it("names the Task from the body that is copied when the body is edited under the decision", async () => {
    const scope = scopeFor();
    const thread = value(
      await run(threads.createThread(scope, { title: "Racing body" })),
    );
    const note = value(
      await run(notes.createNote(scope, { body: "Old name", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(
        await run(
          notes.updateNoteBody(scope, { noteId: note._id, body: "New name" }),
        ),
      );
      return batch(statements);
    });

    const added = value(
      await run(
        adding.addNoteToThread(scope, {
          noteId: note._id,
          threadId: thread._id,
        }),
      ),
    );

    expect(added.thread.tasks).toEqual([
      { _id: expect.any(String), text: "New name", date: jun1 },
    ]);
    expect(added.threadNote.body).toBe("New name");
  });

  it("mints another slug when the new Thread's slug is taken", async () => {
    const scope = scopeFor();
    const random = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((array) => {
        (array as Uint8Array).fill(0);
        return array;
      });
    const first = value(
      await run(threads.createThread(scope, { title: "Repeated" })),
    );
    const note = value(await run(notes.createNote(scope, { body: "Note" })));
    random.mockImplementation((array) => {
      (array as Uint8Array).fill(1);
      return array;
    });
    random.mockImplementationOnce((array) => {
      (array as Uint8Array).fill(0);
      return array;
    });

    const added = value(
      await run(
        adding.createThreadFromNote(scope, {
          noteId: note._id,
          title: "Repeated",
        }),
      ),
    );

    expect(added.thread.slug).not.toBe(first.slug);
    expect(added.thread.slug).toBe("repeated-01010101");
    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM notes WHERE user_id = ?",
    )
      .bind(scope.actorId)
      .first<{ n: number }>();
    expect(remaining?.n).toBe(0);
  });
});

describe("the caller's Task ID", () => {
  it("names the Task a dated Note adds, for both routes", async () => {
    const owner = await createSession("add-to-thread-task-id");
    const thread = await createThread(owner);
    const note = await createNote(owner, "Call back", jun1);

    const added = (
      await call(`/v1/notes/${note._id}/add-to-thread`, {
        method: "POST",
        session: owner,
        body: { threadId: thread._id, taskId: "chosen-task" },
      })
    ).body as NoteAddedToThread;
    expect(added.thread.tasks).toEqual([
      { _id: "chosen-task", text: "Call back", date: jun1 },
    ]);

    const second = await createNote(owner, "Start here", may20);
    const started = (
      await call(`/v1/notes/${second._id}/new-thread`, {
        method: "POST",
        session: owner,
        body: { title: "Started", taskId: "started-task" },
      })
    ).body as NoteAddedToThread;
    expect(started.thread.tasks?.[0]?._id).toBe("started-task");
  });

  it("refuses an ID the Thread already holds, writing nothing", async () => {
    const owner = await createSession("add-to-thread-task-id-clash");
    const thread = await createThread(owner, may20);
    const note = await createNote(owner, "Clash", jun1);
    const before = await everything(owner);

    expectError(
      await call(`/v1/notes/${note._id}/add-to-thread`, {
        method: "POST",
        session: owner,
        body: { threadId: thread._id, taskId: "existing-task" },
      }),
      {
        status: 409,
        code: "conflict",
        message: "The Thread already holds that Task",
      },
    );
    expect(await everything(owner)).toEqual(before);
  });

  it("refuses an ID no row could hold", async () => {
    const owner = await createSession("add-to-thread-task-id-long");
    const thread = await createThread(owner);
    const note = await createNote(owner, "Long", jun1);

    expectError(
      await call(`/v1/notes/${note._id}/add-to-thread`, {
        method: "POST",
        session: owner,
        body: { threadId: thread._id, taskId: "x".repeat(65) },
      }),
      { status: 400, code: "validation" },
    );
  });
});
