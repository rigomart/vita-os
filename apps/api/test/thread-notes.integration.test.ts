import type {
  AreaSummary,
  Thread,
  ThreadDetail,
  ThreadNote,
  ThreadNotePage,
} from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function seedThread(session: Session): Promise<Thread> {
  const area = await succeed<AreaSummary>("/v1/areas", {
    method: "POST",
    session,
    body: {
      name: `Family Health ${crypto.randomUUID()}`,
      icon: "Compass",
    },
  });
  return succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Book checkup", areaId: area._id },
  });
}

async function capture(
  session: Session,
  thread: Thread,
  body: string,
): Promise<ThreadNote> {
  return succeed<ThreadNote>(`/v1/threads/${thread._id}/notes`, {
    method: "POST",
    session,
    body: { body },
  });
}

async function openNotes(
  session: Session,
  thread: Thread,
): Promise<ThreadNote[]> {
  return succeed<ThreadNote[]>(`/v1/threads/${thread._id}/notes`, { session });
}

describe("capturing a Thread Note", () => {
  it("captures an Open Note inside the Thread and counts as Thread activity", async () => {
    const owner = await createSession("thread-note-capture");
    const thread = await seedThread(owner);

    const note = await capture(owner, thread, "  Clinic opens at nine  ");
    const detail = await succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, {
      session: owner,
    });

    expect(note).toMatchObject({ body: "Clinic opens at nine", state: "open" });
    expect(note).not.toHaveProperty("completedAt");
    expect(note.updatedAt).toBe(note.createdAt);
    expect(detail.thread.lastActivityAt).toEqual(expect.any(Number));
    // A captured Note is activity with no Activity Log entry to quote.
    expect(detail.thread).not.toHaveProperty("lastActivityContent");
  });

  it("refuses a blank body", async () => {
    const owner = await createSession("thread-note-blank");
    const thread = await seedThread(owner);

    expectError(
      await call(`/v1/threads/${thread._id}/notes`, {
        method: "POST",
        session: owner,
        body: { body: "  " },
      }),
      {
        status: 400,
        code: "validation",
        message: "Thread note body cannot be empty",
      },
    );
  });

  it("refuses to capture inside another owner's Thread", async () => {
    const owner = await createSession("thread-note-foreign-owner");
    const other = await createSession("thread-note-foreign-other");
    const theirs = await seedThread(other);

    expectError(
      await call(`/v1/threads/${theirs._id}/notes`, {
        method: "POST",
        session: owner,
        body: { body: "Mine now" },
      }),
      { status: 404, code: "not_found", message: "Thread not found." },
    );
    expect(await openNotes(other, theirs)).toEqual([]);
  });
});

describe("reading a Thread's Notes", () => {
  it("reads the Thread's Open Notes, newest first", async () => {
    const owner = await createSession("thread-note-list");
    const thread = await seedThread(owner);
    const other = await seedThread(owner);
    const first = await capture(owner, thread, "First");
    const second = await capture(owner, thread, "Second");
    await capture(owner, other, "Another Thread's note");

    const notes = await openNotes(owner, thread);

    expect(notes.map((note) => note._id)).toEqual([second._id, first._id]);
  });

  it("answers not found for a missing Thread and another owner's Thread alike", async () => {
    const owner = await createSession("thread-note-read-privacy-owner");
    const other = await createSession("thread-note-read-privacy-other");
    const theirs = await seedThread(other);
    await capture(other, theirs, "Private");

    const missing = await call("/v1/threads/absent-thread/notes", {
      session: owner,
    });
    const foreign = await call(`/v1/threads/${theirs._id}/notes`, {
      session: owner,
    });

    expect(foreign).toEqual(missing);
    expectError(foreign, {
      status: 404,
      code: "not_found",
      message: "Thread not found.",
    });
  });

  it("pages the Thread's Done Notes, bounded and stable", async () => {
    const owner = await createSession("thread-note-done-page");
    const thread = await seedThread(owner);
    const completed: string[] = [];
    for (const body of ["one", "two", "three", "four", "five"]) {
      const note = await capture(owner, thread, body);
      await succeed(`/v1/thread-notes/${note._id}/state`, {
        method: "PATCH",
        session: owner,
        body: { state: "done" },
      });
      completed.push(note._id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await succeed<ThreadNotePage>(
        `/v1/threads/${thread._id}/notes/done?limit=2${
          cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`
        }`,
        { session: owner },
      );
      expect(page.entries.length).toBeLessThanOrEqual(2);
      seen.push(...page.entries.map((note) => note._id));
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    expect(seen).toEqual([...completed].reverse());
    expect(await openNotes(owner, thread)).toEqual([]);
  });

  it("refuses an unbounded Done page request", async () => {
    const owner = await createSession("thread-note-page-refusals");
    const thread = await seedThread(owner);

    for (const query of ["limit=0", "limit=51", "limit=nope"]) {
      expectError(
        await call(`/v1/threads/${thread._id}/notes/done?${query}`, {
          session: owner,
        }),
        { status: 400, code: "validation" },
      );
    }
  });
});

describe("editing a Thread Note", () => {
  it("rewrites the body and moves the updated stamp", async () => {
    const owner = await createSession("thread-note-edit");
    const thread = await seedThread(owner);
    const note = await capture(owner, thread, "Clinic opens at nine");

    const edited = await succeed<ThreadNote>(
      `/v1/thread-notes/${note._id}/body`,
      { method: "PATCH", session: owner, body: { body: "  Opens at eight  " } },
    );

    expect(edited.body).toBe("Opens at eight");
    expect(edited.updatedAt).toBeGreaterThanOrEqual(note.updatedAt);
  });

  it("completes and reopens, remembering and then forgetting the completion", async () => {
    const owner = await createSession("thread-note-done-open");
    const thread = await seedThread(owner);
    const note = await capture(owner, thread, "Clinic opens at nine");

    const done = await succeed<ThreadNote>(
      `/v1/thread-notes/${note._id}/state`,
      { method: "PATCH", session: owner, body: { state: "done" } },
    );
    expect(done.state).toBe("done");
    expect(done.completedAt).toEqual(expect.any(Number));
    expect(await openNotes(owner, thread)).toEqual([]);

    const reopened = await succeed<ThreadNote>(
      `/v1/thread-notes/${note._id}/state`,
      { method: "PATCH", session: owner, body: { state: "open" } },
    );
    expect(reopened).not.toHaveProperty("completedAt");
    expect(await openNotes(owner, thread)).toHaveLength(1);
  });

  it("discards a Thread Note", async () => {
    const owner = await createSession("thread-note-remove");
    const thread = await seedThread(owner);
    const note = await capture(owner, thread, "Clinic opens at nine");

    await expect(
      succeed(`/v1/thread-notes/${note._id}`, {
        method: "DELETE",
        session: owner,
      }),
    ).resolves.toEqual({ acknowledged: true });
    expect(await openNotes(owner, thread)).toEqual([]);
  });

  it("refuses every write against another owner's Thread Note", async () => {
    const owner = await createSession("thread-note-write-privacy-owner");
    const other = await createSession("thread-note-write-privacy-other");
    const theirThread = await seedThread(other);
    const theirs = await capture(other, theirThread, "Private");

    for (const [path, method, body] of [
      [`/v1/thread-notes/${theirs._id}/body`, "PATCH", { body: "Mine now" }],
      [`/v1/thread-notes/${theirs._id}/state`, "PATCH", { state: "done" }],
      [`/v1/thread-notes/${theirs._id}`, "DELETE", undefined],
    ] as const) {
      expectError(await call(path, { method, session: owner, body }), {
        status: 404,
        code: "not_found",
        message: "Thread note not found.",
      });
    }

    expect((await openNotes(other, theirThread))[0]).toMatchObject({
      _id: theirs._id,
      body: "Private",
      state: "open",
    });
  });
});
