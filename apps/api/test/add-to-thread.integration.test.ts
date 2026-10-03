import type {
  ActivityLogPage,
  AreaSummary,
  Note,
  NoteAddedToThread,
  OperationResult,
  Thread,
  ThreadDetail,
  ThreadNote,
} from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestRefusal } from "../src/platform/http/errors";
import type { RequestScope } from "../src/platform/request-scope";
import type { Session } from "./sessions";

import * as adding from "../src/features/add-to-thread/operations";
import * as notes from "../src/features/notes/operations";
import * as threads from "../src/features/threads/operations";
import { RequestContext } from "../src/platform/request-scope";
import { call, createSession, expectError, succeed } from "./sessions";

/**
 * Adding a Standalone Note to a Thread, through the Worker the way the browser
 * does it: the Note becomes a Thread Note with its creation time, the earlier
 * Follow-up date wins, and a refused request writes nothing anywhere.
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
  followUp?: number,
): Promise<Thread> {
  const thread = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: `Dentist ${crypto.randomUUID()}` },
  });
  if (followUp === undefined) return thread;
  return succeed<Thread>(`/v1/threads/${thread._id}`, {
    method: "PATCH",
    session,
    body: { followUp },
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
    expect(added.thread.revision).toBe(thread.revision + 1);
    expect(await activityOf(owner, thread._id)).toEqual([]);
    const detail = await succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, {
      session: owner,
    });
    expect(detail.thread).toEqual(added.thread);
  });

  describe("the earlier Follow-up date wins", () => {
    it("brings an undated Thread back at the Note's date and logs it", async () => {
      const owner = await createSession("add-to-thread-undated");
      const thread = await createThread(owner);
      const note = await createNote(owner, "Call back", jun1);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.followUp).toBe(jun1);
      expect(added.thread.lastActivityContent).toBe("Follow-up set");
      expect(await activityOf(owner, thread._id)).toEqual([
        expect.objectContaining({
          type: "follow_up_change",
          content: "Follow-up set",
          newValue: String(jun1),
        }),
      ]);
    });

    it("brings a later Thread date forward to the Note.s", async () => {
      const owner = await createSession("add-to-thread-earlier");
      const thread = await createThread(owner, jun1);
      const past = new Date("2020-01-02T09:15:00").getTime();
      const note = await createNote(owner, "Overdue", past);

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.followUp).toBe(past);
      const [latest] = await activityOf(owner, thread._id);
      expect(latest).toMatchObject({
        type: "follow_up_change",
        content: "Follow-up changed",
        previousValue: String(jun1),
        newValue: String(past),
      });
      expect(await activityOf(owner, thread._id)).toHaveLength(2);
    });

    it.each([
      ["earlier", jun1, may20],
      ["equal", may20, may20],
    ])(
      "drops the Note's date when the Thread's is %s",
      async (_case, noteDate, threadDate) => {
        const owner = await createSession("add-to-thread-later-note");
        const thread = await createThread(owner, threadDate);
        const note = await createNote(owner, "Later", noteDate);

        const added = (await addToThread(owner, note, thread._id))
          .body as NoteAddedToThread;

        expect(added.thread.followUp).toBe(threadDate);
        expect(added.thread).not.toHaveProperty("lastActivityContent");
        // Only the entry that dated the Thread in the first place.
        expect(await activityOf(owner, thread._id)).toHaveLength(1);
      },
    );

    it("leaves a dated Thread's date alone for an undated Note", async () => {
      const owner = await createSession("add-to-thread-undated-note");
      const thread = await createThread(owner, may20);
      const note = await createNote(owner, "Undated");

      const added = (await addToThread(owner, note, thread._id))
        .body as NoteAddedToThread;

      expect(added.thread.followUp).toBe(may20);
      expect(await activityOf(owner, thread._id)).toHaveLength(1);
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

  it("creates the Thread with the Note as its first Thread Note and its date", async () => {
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
      followUp: jun1,
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
    expect(await activityOf(owner, added.thread._id)).toEqual([
      expect.objectContaining({
        type: "follow_up_change",
        content: "Follow-up set",
        newValue: String(jun1),
      }),
    ]);
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([]);
  });

  it("starts an undated Thread from an undated Note with no Activity Log", async () => {
    const owner = await createSession("new-thread-undated");
    const note = await createNote(owner, "Just a thought");

    const added = (await newThread(owner, note, { title: "Thought" }))
      .body as NoteAddedToThread;

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
  function run<T>(
    scope: RequestScope,
    operation: Effect.Effect<T, RequestRefusal, RequestContext>,
  ): Promise<OperationResult<T>> {
    return Effect.runPromise(
      operation.pipe(
        Effect.provideService(RequestContext, scope),
        Effect.match({
          onSuccess: (value): OperationResult<T> => ({ ok: true, value }),
          onFailure: (failure): OperationResult<T> => ({
            ok: false,
            error: failure.error,
          }),
        }),
      ),
    );
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

  it("decides again when the Thread's date changes under the decision", async () => {
    const scope = scopeFor();
    const thread = value(
      await run(scope, threads.createThread({ title: "Racing" })),
    );
    const note = value(
      await run(scope, notes.createNote({ body: "Dated", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      // Another device dates the Thread earlier while this request decides.
      value(
        await run(
          scope,
          threads.updateThread({ threadId: thread._id, followUp: may20 }),
        ),
      );
      return batch(statements);
    });

    const added = value(
      await run(
        scope,
        adding.addNoteToThread({ noteId: note._id, threadId: thread._id }),
      ),
    );

    // The lost batch wrote no orphan entry; the retry kept the earlier date.
    expect(added.thread.followUp).toBe(may20);
    const entries = await env.DB.prepare(
      "SELECT content FROM activity_log_entries WHERE thread_id = ?",
    )
      .bind(thread._id)
      .all();
    expect(entries.results).toEqual([{ content: "Follow-up set" }]);
    const copies = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM thread_notes WHERE thread_id = ?",
    )
      .bind(thread._id)
      .first<{ n: number }>();
    expect(copies?.n).toBe(1);
  });

  it("writes nothing when the Note is completed under the decision", async () => {
    const scope = scopeFor();
    const thread = value(
      await run(scope, threads.createThread({ title: "Racing note" })),
    );
    const note = value(
      await run(scope, notes.createNote({ body: "Dated", followUp: jun1 })),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(await run(scope, notes.markNoteDone({ noteId: note._id })));
      return batch(statements);
    });

    const refused = await run(
      scope,
      adding.addNoteToThread({ noteId: note._id, threadId: thread._id }),
    );

    expect(refused).toMatchObject({
      ok: false,
      error: { code: "not_found", message: "Note not found." },
    });
    const stored = await env.DB.prepare(
      `SELECT revision, follow_up, last_activity_at,
              (SELECT COUNT(*) FROM thread_notes WHERE thread_id = threads.id) AS copies,
              (SELECT COUNT(*) FROM activity_log_entries WHERE thread_id = threads.id) AS entries
       FROM threads WHERE id = ?`,
    )
      .bind(thread._id)
      .first();
    expect(stored).toEqual({
      revision: thread.revision,
      follow_up: null,
      last_activity_at: null,
      copies: 0,
      entries: 0,
    });
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
      await run(scope, threads.createThread({ title: "Repeated" })),
    );
    const note = value(await run(scope, notes.createNote({ body: "Note" })));
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
        scope,
        adding.createThreadFromNote({ noteId: note._id, title: "Repeated" }),
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
