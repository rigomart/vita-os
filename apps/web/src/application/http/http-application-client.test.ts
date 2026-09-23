import type { ThreadId } from "@vita-os/contracts";

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
    nextMove: "Call clinic",
    upNext: ["Book appointment"],
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
    standard: "Appointments are current",
    condition: "needs_attention",
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
  it("encodes routes, queries, and completion expectations while including cookies", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(detail))
      .mockResolvedValueOnce(jsonResponse(activityPage))
      .mockResolvedValueOnce(jsonResponse({ status: "completed" }));
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
      client.completeNextMove({
        threadId: "thread/with/slashes" as ThreadId,
        expectedNextMove: null,
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: true, value: { status: "completed" } });

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
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/complete-next-move",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ expectedNextMove: null, expectedRevision: 0 }),
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
});
