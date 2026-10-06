import type { Note, NotePage } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function capture(
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
  it("captures an Open Note with an optional Follow-up date", async () => {
    const owner = await createSession("note-capture");
    const may20 = Date.UTC(2026, 4, 20);

    const plain = await capture(owner, "  Refill prescription  ");
    const dated = await capture(owner, "Call the dentist", may20);

    expect(plain).toMatchObject({ body: "Refill prescription", state: "open" });
    expect(plain).not.toHaveProperty("followUp");
    expect(plain).not.toHaveProperty("completedAt");
    expect(plain.updatedAt).toBe(plain.createdAt);
    expect(dated.followUp).toBe(may20);
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
  it("uses Follow-up dates while preserving the stored date column", async () => {
    const owner = await createSession("note-follow-up-storage");
    const original = Date.UTC(2026, 4, 20, 15);
    const next = Date.UTC(2026, 4, 21, 9);
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Previously saved Note", followUp: original },
    });

    expect(note).toMatchObject({ followUp: original });
    const changed = await succeed(`/v1/notes/${note._id}/follow-up`, {
      method: "PATCH",
      session: owner,
      body: { followUp: next },
    });
    expect(changed).toMatchObject({ followUp: next });
    expect((await openNotes(owner))[0]).toMatchObject({ followUp: next });
    const stored = await env.DB.prepare(
      "SELECT attention_date FROM notes WHERE id = ?",
    )
      .bind(note._id)
      .first<{ attention_date: number }>();
    expect(stored?.attention_date).toBe(next);

    const cleared = await succeed(`/v1/notes/${note._id}/follow-up`, {
      method: "PATCH",
      session: owner,
      body: { followUp: null },
    });
    expect(cleared).not.toHaveProperty("followUp");
    expect(cleared).not.toHaveProperty("attentionDate");
  });

  it("rejects unknown fields or invalid Follow-up dates", async () => {
    const owner = await createSession("note-follow-up-validation");
    const note = await capture(owner, "Remember this");
    for (const body of [
      { followUp: "tomorrow" },
      {},
      { followUp: 1, attentionDate: 2 },
    ]) {
      expectError(
        await call(`/v1/notes/${note._id}/follow-up`, {
          method: "PATCH",
          session: owner,
          body,
        }),
        { status: 400, code: "validation" },
      );
    }
    expectError(
      await call("/v1/notes", {
        method: "POST",
        session: owner,
        body: { body: "Unknown field", followUp: 1, attentionDate: 2 },
      }),
      { status: 400, code: "validation" },
    );
  });

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

  it("sets and clears the Follow-up date", async () => {
    const owner = await createSession("note-edit-when");
    const note = await capture(owner, "Call the dentist");
    const may20 = Date.UTC(2026, 4, 20);

    const dated = await succeed<Note>(`/v1/notes/${note._id}/follow-up`, {
      method: "PATCH",
      session: owner,
      body: { followUp: may20 },
    });
    const cleared = await succeed<Note>(`/v1/notes/${note._id}/follow-up`, {
      method: "PATCH",
      session: owner,
      body: { followUp: null },
    });

    expect(dated.followUp).toBe(may20);
    expect(cleared).not.toHaveProperty("followUp");
  });

  it("refuses a blank body and an unreadable Follow-up date", async () => {
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
      await call(`/v1/notes/${note._id}/follow-up`, {
        method: "PATCH",
        session: owner,
        body: { followUp: "tomorrow" },
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

describe("searching Archived Notes", () => {
  async function archive(session: Session, body: string): Promise<Note> {
    const note = await capture(session, body);
    return succeed<Note>(`/v1/notes/${note._id}/state`, {
      method: "PATCH",
      session,
      body: { state: "done" },
    });
  }

  async function search(session: Session, q: string, limit = 20) {
    const page = await succeed<NotePage>(
      `/v1/notes/done?limit=${limit}&q=${encodeURIComponent(q)}`,
      { session },
    );
    return page;
  }

  it("finds bodies containing every word, in any order or case, newest archive first", async () => {
    const owner = await createSession("note-search-words");
    const milk = await archive(owner, "Buy milk and EGGS");
    await archive(owner, "Buy bread");
    const later = await archive(owner, "eggs, then milk");
    await capture(owner, "Open milk eggs note");

    const page = await search(owner, "  eggs   milk ");

    expect(page.entries.map((note) => note._id)).toEqual([later._id, milk._id]);
    expect((await search(owner, "   ")).entries).toHaveLength(3);
  });

  it("matches %, _ and the escape character literally", async () => {
    const owner = await createSession("note-search-escaping");
    const percent = await archive(owner, "Rent up 50% this year");
    await archive(owner, "Rent up 500 this year");
    const underscore = await archive(owner, "file_name.txt");
    await archive(owner, "filename.txt");
    const backslash = await archive(owner, "C:\\temp\\notes");
    await archive(owner, "C:/temp/notes");

    expect((await search(owner, "50%")).entries.map((n) => n._id)).toEqual([
      percent._id,
    ]);
    expect((await search(owner, "e_n")).entries.map((n) => n._id)).toEqual([
      underscore._id,
    ]);
    expect((await search(owner, "\\temp")).entries.map((n) => n._id)).toEqual([
      backslash._id,
    ]);
  });

  it("searches only the actor's Archived Notes", async () => {
    const owner = await createSession("note-search-owner");
    const other = await createSession("note-search-other");
    const mine = await archive(owner, "Passport renewal receipt");
    await archive(other, "Passport renewal receipt");

    expect((await search(owner, "passport")).entries.map((n) => n._id)).toEqual(
      [mine._id],
    );
  });

  it("pages a search across every Archived Note, not only the first page", async () => {
    const owner = await createSession("note-search-pages");
    const match = await archive(owner, "The oldest needle");
    for (let index = 0; index < 4; index += 1) {
      await archive(owner, `Haystack ${index}`);
    }

    const first = await search(owner, "needle", 2);
    expect(first.entries.map((note) => note._id)).toEqual([match._id]);
    expect(first.nextCursor).toBeUndefined();

    const unsearched = await succeed<NotePage>("/v1/notes/done?limit=2", {
      session: owner,
    });
    expect(unsearched.entries.map((note) => note._id)).not.toContain(match._id);
  });

  it("refuses a search past its bounds", async () => {
    const owner = await createSession("note-search-bounds");

    expectError(
      await call(`/v1/notes/done?q=${"a".repeat(201)}`, { session: owner }),
      { status: 400, code: "validation" },
    );
    expectError(
      await call(
        `/v1/notes/done?q=${encodeURIComponent("a b c d e f g h i")}`,
        {
          session: owner,
        },
      ),
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
      [`/v1/notes/${theirs._id}/follow-up`, { followUp: 1 }],
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
