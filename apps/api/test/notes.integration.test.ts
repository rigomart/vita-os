import type { Note, NotePage } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function capture(
  session: Session,
  body: string,
  when?: number,
): Promise<Note> {
  return succeed<Note>("/v1/notes", {
    method: "POST",
    session,
    body: { body, ...(when === undefined ? {} : { when }) },
  });
}

async function openNotes(session: Session): Promise<Note[]> {
  return succeed<Note[]>("/v1/notes", { session });
}

async function openCount(session: Session): Promise<number> {
  const { count } = await succeed<{ count: number }>("/v1/notes/open-count", {
    session,
  });
  return count;
}

describe("capturing a Note", () => {
  it("captures an Open Note with an optional Attention Date", async () => {
    const owner = await createSession("note-capture");
    const may20 = Date.UTC(2026, 4, 20);

    const plain = await capture(owner, "  Refill prescription  ");
    const dated = await capture(owner, "Call the dentist", may20);

    expect(plain).toMatchObject({ body: "Refill prescription", state: "open" });
    expect(plain).not.toHaveProperty("when");
    expect(plain).not.toHaveProperty("completedAt");
    expect(plain.updatedAt).toBe(plain.createdAt);
    expect(dated.when).toBe(may20);
  });

  it("refuses a blank body", async () => {
    const owner = await createSession("note-capture-blank");

    expectError(
      await call("/v1/notes", {
        method: "POST",
        session: owner,
        body: { body: "   " },
      }),
      { status: 400, code: "validation", message: "Note body cannot be empty" },
    );
  });

  it("requires authentication", async () => {
    expectError(await call("/v1/notes"), { status: 401, code: "unauthorized" });
    expectError(
      await call("/v1/notes", { method: "POST", body: { body: "Sneaky" } }),
      { status: 401, code: "unauthorized" },
    );
  });
});

describe("the Open Notes inventory", () => {
  it("reads only the actor's Open Notes, newest first", async () => {
    const owner = await createSession("note-list-owner");
    const other = await createSession("note-list-other");
    const first = await capture(owner, "First");
    const second = await capture(owner, "Second");
    await capture(other, "Theirs");

    const notes = await openNotes(owner);

    expect(notes.map((note) => note._id)).toEqual([second._id, first._id]);
    expect(await openCount(owner)).toBe(2);
    expect(await openCount(other)).toBe(1);
  });

  it("counts the same Notes the list reads", async () => {
    const owner = await createSession("note-count");
    const note = await capture(owner, "Refill prescription");

    await succeed(`/v1/notes/${note._id}/state`, {
      method: "PATCH",
      session: owner,
      body: { state: "done" },
    });

    expect(await openNotes(owner)).toEqual([]);
    expect(await openCount(owner)).toBe(0);
  });

  it("orders Notes captured in the same millisecond stably", async () => {
    const owner = await createSession("note-tied-order");
    await env.DB.batch(
      ["note-tie-a", "note-tie-b", "note-tie-c"].map((id) =>
        env.DB.prepare(
          `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, NULL, 'open', NULL, ?, ?)`,
        ).bind(id, owner.actorId, id, 1_600_000_000_000, 1_600_000_000_000),
      ),
    );

    const notes = await openNotes(owner);

    expect(notes.map((note) => note._id)).toEqual([
      "note-tie-c",
      "note-tie-b",
      "note-tie-a",
    ]);
  });
});

describe("editing a Note", () => {
  it("rewrites the body and moves the updated stamp", async () => {
    const owner = await createSession("note-edit-body");
    const note = await capture(owner, "Refill prescription");

    const edited = await succeed<Note>(`/v1/notes/${note._id}/body`, {
      method: "PATCH",
      session: owner,
      body: { body: "  Refill both prescriptions  " },
    });

    expect(edited.body).toBe("Refill both prescriptions");
    expect(edited.updatedAt).toBeGreaterThanOrEqual(note.updatedAt ?? 0);
    expect(edited.createdAt).toBe(note.createdAt);
  });

  it("sets and clears the Attention Date", async () => {
    const owner = await createSession("note-edit-when");
    const note = await capture(owner, "Call the dentist");
    const may20 = Date.UTC(2026, 4, 20);

    const dated = await succeed<Note>(`/v1/notes/${note._id}/attention-date`, {
      method: "PATCH",
      session: owner,
      body: { when: may20 },
    });
    const cleared = await succeed<Note>(
      `/v1/notes/${note._id}/attention-date`,
      {
        method: "PATCH",
        session: owner,
        body: { when: null },
      },
    );

    expect(dated.when).toBe(may20);
    expect(cleared).not.toHaveProperty("when");
  });

  it("refuses a blank body and an unreadable Attention Date", async () => {
    const owner = await createSession("note-edit-refusals");
    const note = await capture(owner, "Refill prescription");

    expectError(
      await call(`/v1/notes/${note._id}/body`, {
        method: "PATCH",
        session: owner,
        body: { body: " " },
      }),
      { status: 400, code: "validation", message: "Note body cannot be empty" },
    );
    expectError(
      await call(`/v1/notes/${note._id}/attention-date`, {
        method: "PATCH",
        session: owner,
        body: { when: "tomorrow" },
      }),
      { status: 400, code: "validation" },
    );
  });
});

describe("Done and Open history", () => {
  it("completing a Note records when, and reopening forgets it", async () => {
    const owner = await createSession("note-done-open");
    const note = await capture(owner, "Refill prescription");

    const done = await succeed<Note>(`/v1/notes/${note._id}/state`, {
      method: "PATCH",
      session: owner,
      body: { state: "done" },
    });
    expect(done).toMatchObject({ state: "done" });
    expect(done.completedAt).toEqual(expect.any(Number));

    const reopened = await succeed<Note>(`/v1/notes/${note._id}/state`, {
      method: "PATCH",
      session: owner,
      body: { state: "open" },
    });
    expect(reopened.state).toBe("open");
    expect(reopened).not.toHaveProperty("completedAt");
    expect(await openNotes(owner)).toHaveLength(1);
  });

  it("pages Done Notes newest-completed first, without duplicates or gaps", async () => {
    const owner = await createSession("note-done-page");
    const bodies = ["one", "two", "three", "four", "five"];
    const completed: string[] = [];
    for (const body of bodies) {
      const note = await capture(owner, body);
      await succeed(`/v1/notes/${note._id}/state`, {
        method: "PATCH",
        session: owner,
        body: { state: "done" },
      });
      completed.push(note._id);
    }

    const first = await succeed<NotePage>("/v1/notes/done?limit=2", {
      session: owner,
    });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));

    const seen = first.entries.map((note) => note._id);
    let cursor = first.nextCursor;
    while (cursor !== undefined) {
      const page = await succeed<NotePage>(
        `/v1/notes/done?limit=2&cursor=${encodeURIComponent(cursor)}`,
        { session: owner },
      );
      seen.push(...page.entries.map((note) => note._id));
      cursor = page.nextCursor;
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual([...completed].reverse());
  });

  it("puts Done Notes with no recorded completion last, and pages past them", async () => {
    const owner = await createSession("note-done-legacy");
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
         VALUES (?, ?, 'Imported', NULL, 'done', NULL, ?, NULL)`,
      ).bind("note-legacy-a", owner.actorId, 1_500_000_000_000),
      env.DB.prepare(
        `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
         VALUES (?, ?, 'Imported too', NULL, 'done', NULL, ?, NULL)`,
      ).bind("note-legacy-b", owner.actorId, 1_500_000_000_001),
      env.DB.prepare(
        `INSERT INTO notes (id, user_id, body, attention_date, state, completed_at, created_at, updated_at)
         VALUES (?, ?, 'Completed here', NULL, 'done', ?, ?, ?)`,
      ).bind(
        "note-recent",
        owner.actorId,
        1_600_000_000_000,
        1_600_000_000_000,
        1_600_000_000_000,
      ),
    ]);

    const first = await succeed<NotePage>("/v1/notes/done?limit=2", {
      session: owner,
    });
    const second = await succeed<NotePage>(
      `/v1/notes/done?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
      { session: owner },
    );

    expect(first.entries.map((note) => note._id)).toEqual([
      "note-recent",
      "note-legacy-b",
    ]);
    expect(second.entries.map((note) => note._id)).toEqual(["note-legacy-a"]);
    expect(second.nextCursor).toBeUndefined();
  });

  it("refuses an unbounded, malformed, or foreign page request", async () => {
    const owner = await createSession("note-done-pagination-refusals");

    for (const query of ["limit=0", "limit=51", "limit=2.5", "limit=many"]) {
      expectError(await call(`/v1/notes/done?${query}`, { session: owner }), {
        status: 400,
        code: "validation",
      });
    }
    expectError(
      await call("/v1/notes/done?limit=2&cursor=not-a-cursor", {
        session: owner,
      }),
      { status: 400, code: "validation" },
    );
  });
});

describe("discarding a Note", () => {
  it("removes the Note from the Inbox", async () => {
    const owner = await createSession("note-remove");
    const note = await capture(owner, "Refill prescription");

    await expect(
      succeed(`/v1/notes/${note._id}`, { method: "DELETE", session: owner }),
    ).resolves.toEqual({ acknowledged: true });
    expect(await openNotes(owner)).toEqual([]);
  });

  it("answers the same way for a missing Note and another owner's Note", async () => {
    const owner = await createSession("note-privacy-owner");
    const other = await createSession("note-privacy-other");
    const theirs = await capture(other, "Private");

    const missing = await call("/v1/notes/absent-note", {
      method: "DELETE",
      session: owner,
    });
    const foreign = await call(`/v1/notes/${theirs._id}`, {
      method: "DELETE",
      session: owner,
    });

    expect(foreign).toEqual(missing);
    expectError(foreign, {
      status: 404,
      code: "not_found",
      message: "Note not found.",
    });
    expect(await openNotes(other)).toHaveLength(1);
  });

  it("refuses every write against another owner's Note", async () => {
    const owner = await createSession("note-write-privacy-owner");
    const other = await createSession("note-write-privacy-other");
    const theirs = await capture(other, "Private");

    for (const [path, body] of [
      [`/v1/notes/${theirs._id}/body`, { body: "Mine now" }],
      [`/v1/notes/${theirs._id}/attention-date`, { when: 1 }],
      [`/v1/notes/${theirs._id}/state`, { state: "done" }],
    ] as const) {
      expectError(await call(path, { method: "PATCH", session: owner, body }), {
        status: 404,
        code: "not_found",
        message: "Note not found.",
      });
    }

    expect((await openNotes(other))[0]).toMatchObject({
      _id: theirs._id,
      body: "Private",
      state: "open",
    });
  });
});
