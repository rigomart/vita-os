import type { ApplicationClient } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createHttpApplicationClient } from "../../web/src/application/http/http-application-client";
import worker from "../src/worker";
import { createSession, type Session } from "./sessions";

/**
 * Every Vita OS workflow, driven through the public HTTP client against the real
 * Worker and a real local database.
 *
 * Nothing here reaches for a route, a SQL statement, or a store: if an operation
 * works from this seam, it works from the browser.
 */
function clientFor(session: Session): ApplicationClient {
  return createHttpApplicationClient({
    apiBaseUrl: "http://api.test",
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("cookie", session.cookie);
      headers.set("origin", "http://browser.test");
      return worker.fetch(new Request(input, { ...init, headers }), env);
    },
  });
}

/** The value of an operation that must have succeeded. */
async function value<T>(
  operation: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>,
): Promise<T> {
  const result = await operation;
  if (!result.ok) {
    throw new Error(`Operation failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

describe("Areas through the HTTP client", () => {
  it("creates an Area from the picker, labels a Thread, removes the label, and deletes the Area", async () => {
    const client = clientFor(await createSession("client-areas"));
    const thread = await value(client.createThread({ title: "Book checkup" }));
    expect(thread).not.toHaveProperty("areaId");

    const area = await value(
      client.createArea({ name: "Family Health", icon: "HeartPulse" }),
    );
    expect(area).toMatchObject({
      name: "Family Health",
      icon: "HeartPulse",
      order: 0,
    });
    await expect(
      client.createArea({ name: "family health", icon: "Compass" }),
    ).resolves.toEqual({ ok: true, value: area });

    const labeled = await value(
      client.updateThread({ threadId: thread._id, areaId: area._id }),
    );
    expect(labeled.areaId).toBe(area._id);
    await expect(
      client.getThreadDetail({ slug: thread.slug }),
    ).resolves.toMatchObject({ ok: true, value: { area } });

    const unlabeled = await value(
      client.updateThread({ threadId: thread._id, areaId: null }),
    );
    expect(unlabeled).not.toHaveProperty("areaId");
    const activity = await value(
      client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
    );
    expect(activity.entries.map((entry) => entry.content)).toEqual([
      'Removed from "Family Health"',
      'Added to "Family Health"',
    ]);

    const renamed = await value(
      client.updateArea({ areaId: area._id, name: "Health", icon: "Dumbbell" }),
    );
    expect(renamed).toMatchObject({ name: "Health", icon: "Dumbbell" });
    const second = await value(
      client.createArea({ name: "Home", icon: "Home" }),
    );
    await expect(
      client.reorderAreas({ areaIds: [second._id, area._id] }),
    ).resolves.toMatchObject({
      ok: true,
      value: [{ _id: second._id }, { _id: area._id }],
    });

    await expect(client.removeArea({ areaId: area._id })).resolves.toEqual({
      ok: true,
      value: { acknowledged: true },
    });
    await expect(client.listAreas()).resolves.toEqual({
      ok: true,
      value: [{ ...second, order: 0 }],
    });
  });

  it("reports a refused Area name as a validation failure", async () => {
    const client = clientFor(await createSession("client-area-validation"));

    await expect(
      client.createArea({ name: "  ", icon: "Compass" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "Area name cannot be empty",
        retryable: false,
      },
    });
  });

  it("deletes an Area that still labels a Thread, leaving the Thread unlabeled", async () => {
    const client = clientFor(await createSession("client-area-delete-labeled"));
    const area = await value(
      client.createArea({
        name: "Health",
        icon: "Compass",
      }),
    );
    const thread = await value(
      client.createThread({ title: "Book checkup", areaId: area._id }),
    );

    await expect(client.removeArea({ areaId: area._id })).resolves.toEqual({
      ok: true,
      value: { acknowledged: true },
    });
    await expect(client.getThreadDetail({ slug: thread.slug })).resolves.toEqual({
      ok: true,
      value: { thread: (({ areaId: _areaId, ...rest }) => rest)(thread) },
    });
  });
});

describe("Threads through the HTTP client", () => {
  it("runs a Thread from capture to resolution", async () => {
    const client = clientFor(await createSession("client-threads"));
    const area = await value(
      client.createArea({
        name: "Health",
        icon: "Compass",
      }),
    );

    const thread = await value(
      client.createThread({
        title: "Book checkup",
        summary: "Choose a clinic",
        areaId: area._id,
      }),
    );
    expect(thread).toMatchObject({ state: "open", order: 0 });

    const withMove = await value(
      client.updateThread({ threadId: thread._id, nextMove: "Call clinic" }),
    );
    expect(withMove.nextMove).toBe("Call clinic");

    const lined = await value(
      client.replaceUpNext({
        threadId: thread._id,
        moves: ["Book appointment", "Collect results"],
      }),
    );
    expect(lined.upNext).toEqual(["Book appointment", "Collect results"]);

    const detail = await value(client.getThreadDetail({ slug: thread.slug }));
    await expect(
      client.completeNextMove({
        threadId: thread._id,
        expectedNextMove: "Call clinic",
        expectedRevision: detail.thread.revision,
      }),
    ).resolves.toEqual({ ok: true, value: { status: "completed" } });

    const promoted = await value(client.getThreadDetail({ slug: thread.slug }));
    expect(promoted.thread.nextMove).toBe("Book appointment");
    expect(promoted.thread.upNext).toEqual(["Collect results"]);

    const activity = await value(
      client.getThreadActivityPage({ threadId: thread._id, limit: 20 }),
    );
    expect(activity.entries.map((entry) => entry.content)).toEqual([
      'Completed "Call clinic" — next move set to "Book appointment"',
      'Next move set to "Call clinic"',
    ]);

    const resolved = await value(
      client.updateThread({
        threadId: thread._id,
        state: "resolved",
        resolutionNote: "Clinic confirmed",
      }),
    );
    expect(resolved.state).toBe("resolved");
    await expect(client.listOpenThreads()).resolves.toEqual({
      ok: true,
      value: [],
    });

    await expect(
      client.removeThread({ threadId: thread._id }),
    ).resolves.toEqual({ ok: true, value: { acknowledged: true } });
  });

  it("reports an Up Next write on a resolved Thread as a conflict", async () => {
    const client = clientFor(await createSession("client-up-next-conflict"));
    const area = await value(
      client.createArea({
        name: "Health",
        icon: "Compass",
      }),
    );
    const thread = await value(
      client.createThread({ title: "Book checkup", areaId: area._id }),
    );
    await value(
      client.updateThread({ threadId: thread._id, state: "resolved" }),
    );

    await expect(
      client.replaceUpNext({ threadId: thread._id, moves: ["Too late"] }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "Cannot line up moves on a resolved thread",
        retryable: false,
      },
    });
  });
});

describe("Notes through the HTTP client", () => {
  it("captures, edits, completes, pages, reopens, and discards a Note", async () => {
    const client = clientFor(await createSession("client-notes"));
    const may20 = Date.UTC(2026, 4, 20);

    const note = await value(
      client.createNote({ body: "Refill prescription" }),
    );
    expect(note).toMatchObject({ body: "Refill prescription", state: "open" });
    await expect(client.countOpenNotes()).resolves.toEqual({
      ok: true,
      value: 1,
    });

    const edited = await value(
      client.updateNoteBody({ noteId: note._id, body: "Refill both" }),
    );
    expect(edited.body).toBe("Refill both");

    const dated = await value(
      client.updateNoteAttentionDate({
        noteId: note._id,
        attentionDate: may20,
      }),
    );
    expect(dated.attentionDate).toBe(may20);
    const undated = await value(
      client.updateNoteAttentionDate({ noteId: note._id, attentionDate: null }),
    );
    expect(undated).not.toHaveProperty("when");

    const done = await value(client.markNoteDone({ noteId: note._id }));
    expect(done.state).toBe("done");
    await expect(client.listOpenNotes()).resolves.toEqual({
      ok: true,
      value: [],
    });
    await expect(client.getDoneNotePage({ limit: 20 })).resolves.toEqual({
      ok: true,
      value: { entries: [done] },
    });

    const reopened = await value(client.markNoteOpen({ noteId: note._id }));
    expect(reopened.state).toBe("open");

    await expect(client.removeNote({ noteId: note._id })).resolves.toEqual({
      ok: true,
      value: { acknowledged: true },
    });
    await expect(client.countOpenNotes()).resolves.toEqual({
      ok: true,
      value: 0,
    });
  });
});

describe("Thread Notes through the HTTP client", () => {
  it("captures, edits, completes, pages, and discards a Thread Note", async () => {
    const client = clientFor(await createSession("client-thread-notes"));
    const area = await value(
      client.createArea({
        name: "Health",
        icon: "Compass",
      }),
    );
    const thread = await value(
      client.createThread({ title: "Book checkup", areaId: area._id }),
    );

    const note = await value(
      client.createThreadNote({
        threadId: thread._id,
        body: "Clinic opens at nine",
      }),
    );
    await expect(
      client.listOpenThreadNotes({ threadId: thread._id }),
    ).resolves.toEqual({ ok: true, value: [note] });

    const edited = await value(
      client.updateThreadNoteBody({
        threadNoteId: note._id,
        body: "Opens at eight",
      }),
    );
    expect(edited.body).toBe("Opens at eight");

    const done = await value(
      client.markThreadNoteDone({ threadNoteId: note._id }),
    );
    await expect(
      client.getDoneThreadNotePage({ threadId: thread._id, limit: 20 }),
    ).resolves.toEqual({ ok: true, value: { entries: [done] } });

    await value(client.markThreadNoteOpen({ threadNoteId: note._id }));
    await expect(
      client.removeThreadNote({ threadNoteId: note._id }),
    ).resolves.toEqual({ ok: true, value: { acknowledged: true } });
    await expect(
      client.listOpenThreadNotes({ threadId: thread._id }),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it("reports another owner's records as not found, whatever the operation", async () => {
    const owner = await createSession("client-privacy-owner");
    const other = await createSession("client-privacy-other");
    const ownerClient = clientFor(owner);
    const otherClient = clientFor(other);
    const theirArea = await value(
      otherClient.createArea({
        name: "Private",
        icon: "Compass",
      }),
    );
    const theirThread = await value(
      otherClient.createThread({ title: "Private", areaId: theirArea._id }),
    );
    const theirNote = await value(otherClient.createNote({ body: "Private" }));

    const notFound = {
      ok: false,
      error: {
        code: "not_found",
        retryable: false,
        message: expect.any(String),
      },
    };
    await expect(
      ownerClient.updateArea({ areaId: theirArea._id, name: "Mine now" }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.removeArea({ areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.updateThread({ threadId: theirThread._id, areaId: null }),
    ).resolves.toMatchObject(notFound);
    const mine = await value(ownerClient.createThread({ title: "Mine" }));
    await expect(
      ownerClient.updateThread({ threadId: mine._id, areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.createThread({ title: "Mine too", areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.getThreadDetail({ slug: theirThread.slug }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.listOpenThreadNotes({ threadId: theirThread._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.updateNoteBody({ noteId: theirNote._id, body: "Mine now" }),
    ).resolves.toMatchObject(notFound);
    await expect(ownerClient.listAreas()).resolves.toEqual({
      ok: true,
      value: [],
    });
    await expect(ownerClient.listOpenNotes()).resolves.toEqual({
      ok: true,
      value: [],
    });
  });
});

describe("failures the HTTP client reports without a service", () => {
  it("reports a request that never reached the service as unavailable", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: () => Promise.reject(new Error("network down")),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
        retryable: true,
      },
    });
  });

  it("reports an unrecognized response shape as unexpected", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify([{ _id: "area-1" }]), {
            headers: { "content-type": "application/json" },
          }),
        ),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected response from the service.",
        retryable: false,
      },
    });
  });

  it("reports an unauthenticated call as unauthorized", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: async (input, init) =>
        worker.fetch(new Request(input, init), env),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Authentication required.",
        retryable: false,
      },
    });
  });
});
