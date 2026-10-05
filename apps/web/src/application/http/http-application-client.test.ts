import type { AreaId, TaskId, NoteId, ThreadId } from "@vita-os/contracts";

import { describe, expect, it, vi } from "vitest";

import { createHttpApplicationClient } from "./http-application-client";

const detail = {
  thread: {
    _id: "thread/with/slashes",
    title: "Book checkup",
    slug: "book-checkup",
    summary: "Choose a clinic",
    areaId: "area-1",
    order: 2,
    state: "open",
    tasks: [
      { _id: "task/1", text: "Call clinic" },
      { _id: "task-2", text: "Book appointment" },
    ],
    focusedTaskId: "task/1",
    followUp: 1_800_000_000_000,
    lastActivityAt: 1_700_000_000_000,
    lastActivityContent: "Captured next move",
    revision: 0,
    createdAt: 1_600_000_000_000,
  },
  area: {
    _id: "area-1",
    name: "Family Health",
    slug: "family-health",
    icon: "HeartPulse",
    order: 1,
    createdAt: 1_500_000_000_000,
  },
};

const activityPage = {
  entries: [
    {
      _id: "log-1",
      type: "next_move_change",
      content: "Captured a Next Move",
      newValue: "Call clinic",
      createdAt: 1_700_000_000_000,
    },
  ],
  nextCursor: "eyJ2IjoxfQ",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function applicationError(code: string, message: string, retryable: boolean) {
  return { error: { code, message, retryable } };
}

describe("createHttpApplicationClient", () => {
  it("calls fetch the way a browser requires, without an object as its receiver", async () => {
    // Browsers reject fetch called with any `this` other than the window.
    const fetchImpl = vi.fn(function (this: unknown) {
      if (this !== undefined && this !== globalThis) {
        return Promise.reject(new TypeError("Illegal invocation"));
      }
      return Promise.resolve(jsonResponse([]));
    }) as unknown as typeof fetch;
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });

    await expect(client.listAreas()).resolves.toEqual({ ok: true, value: [] });
  });

  it("encodes routes, queries, and Task commands while including cookies", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(detail))
      .mockResolvedValueOnce(jsonResponse(activityPage))
      .mockResolvedValueOnce(jsonResponse(detail.thread))
      .mockResolvedValueOnce(jsonResponse(detail.thread));
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test/",
      fetchImpl,
    });

    await expect(
      client.getThreadDetail({ slug: "book/checkup" }),
    ).resolves.toEqual({ ok: true, value: detail });
    await expect(
      client.getThreadActivityPage({
        threadId: "thread/with/slashes" as ThreadId,
        limit: 2,
        cursor: "cursor +/=&",
      }),
    ).resolves.toEqual({ ok: true, value: activityPage });
    await expect(
      client.completeTask({
        threadId: "thread/with/slashes" as ThreadId,
        taskId: "task/1" as TaskId,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: true, value: detail.thread });
    await expect(
      client.focusTask({
        threadId: "thread/with/slashes" as ThreadId,
        taskId: null,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: true, value: detail.thread });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.test/v1/threads/book%2Fcheckup",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/activity?limit=2&cursor=cursor+%2B%2F%3D%26",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/tasks/task%2F1/complete",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ expectedRevision: 0 }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/focus",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ taskId: null, expectedRevision: 0 }),
      }),
    );
  });

  it.each([
    [400, "validation", false],
    [401, "unauthorized", false],
    [403, "unauthorized", false],
    [404, "not_found", false],
    [409, "conflict", false],
    [415, "validation", false],
    [502, "unavailable", true],
    [503, "unavailable", true],
    [504, "unavailable", true],
  ] as const)("maps HTTP %i to %s", async (status, code, retryable) => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(
            applicationError("unexpected", "A server error", false),
            status,
          ),
        ),
    });

    await expect(client.getThreadDetail({ slug: "missing" })).resolves.toEqual({
      ok: false,
      error: {
        code,
        message: "A server error",
        retryable,
      },
    });
  });

  it("maps a rejected network request to a retryable unavailable result", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("offline")),
    });

    await expect(
      client.getThreadDetail({ slug: "book-checkup" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
        retryable: true,
      },
    });
  });

  it("rejects malformed successful and expected-error JSON as unexpected", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ thread: detail.thread, area: {} }))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "not_found" } }, 404),
      );
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });

    await expect(
      client.getThreadDetail({ slug: "book-checkup" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected response from the service.",
        retryable: false,
      },
    });
    await expect(client.getThreadDetail({ slug: "missing" })).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected response from the service.",
        retryable: false,
      },
    });
  });

  it.each([
    ["missing", undefined],
    ["negative", -1],
  ])("rejects a %s Thread revision", async (_case, revision) => {
    const thread = { ...detail.thread } as Record<string, unknown>;
    if (revision === undefined) delete thread.revision;
    else thread.revision = revision;
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ ...detail, thread })),
    });

    await expect(
      client.getThreadDetail({ slug: "book-checkup" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected response from the service.",
        retryable: false,
      },
    });
  });

  it("adds a Note to a Thread and starts a Thread from a Note", async () => {
    const added = {
      thread: detail.thread,
      threadNote: {
        _id: "thread-note-1",
        body: "Clinic opens at nine",
        state: "open",
        createdAt: 1_600_000_000_000,
        updatedAt: 1_600_000_000_000,
      },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(added))
      .mockResolvedValueOnce(jsonResponse(added, 201))
      .mockResolvedValueOnce(jsonResponse({ thread: detail.thread }));
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });

    await expect(
      client.addNoteToThread({
        noteId: "note/1" as NoteId,
        threadId: "thread/with/slashes" as ThreadId,
      }),
    ).resolves.toEqual({ ok: true, value: added });
    await expect(
      client.createThreadFromNote({
        noteId: "note/1" as NoteId,
        title: "Book checkup",
        areaId: "area-1" as AreaId,
      }),
    ).resolves.toEqual({ ok: true, value: added });
    await expect(
      client.addNoteToThread({
        noteId: "note-1" as NoteId,
        threadId: "thread-1" as ThreadId,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.test/v1/notes/note%2F1/add-to-thread",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ threadId: "thread/with/slashes" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.test/v1/notes/note%2F1/new-thread",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Book checkup", areaId: "area-1" }),
      }),
    );
  });
});
