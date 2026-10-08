import type {
  ApplicationClient,
  AreaId,
  TaskId,
  NoteId,
  ThreadId,
  ThreadNoteId,
} from "@vita-os/contracts";

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
    lastActivityAt: 1_700_000_000_000,
    lastActivityContent: "Captured next move",
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

const note = {
  _id: "note-1",
  body: "Clinic opens at nine",
  state: "open",
  createdAt: 1_600_000_000_000,
};

const threadNote = {
  ...note,
  _id: "thread-note-1",
  updatedAt: 1_600_000_000_000,
};

const responseFamilies = [
  {
    name: "Notes",
    entry: note,
    page: false,
    read: (client: ApplicationClient) => client.listOpenNotes(),
  },
  {
    name: "Thread Notes",
    entry: threadNote,
    page: false,
    read: (client: ApplicationClient) =>
      client.listOpenThreadNotes({ threadId: "thread-1" as ThreadId }),
  },
  {
    name: "Note page",
    entry: note,
    page: true,
    read: (client: ApplicationClient) => client.getDoneNotePage({ limit: 2 }),
  },
  {
    name: "Thread Note page",
    entry: threadNote,
    page: true,
    read: (client: ApplicationClient) =>
      client.getDoneThreadNotePage({
        threadId: "thread-1" as ThreadId,
        limit: 2,
      }),
  },
];

function respondingClient(body: unknown) {
  return createHttpApplicationClient({
    apiBaseUrl: "https://api.test",
    fetchImpl: async () => jsonResponse(body),
  });
}

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
  it.each(responseFamilies)(
    "decodes $name and strips private fields",
    async ({ entry, page, read }) => {
      const entries = [{ ...entry, ownerId: "private-user", revision: 3 }];
      const body = page ? { entries, privateCursor: "secret" } : entries;
      await expect(read(respondingClient(body))).resolves.toEqual({
        ok: true,
        value: page ? { entries: [entry] } : [entry],
      });
    },
  );

  it.each(responseFamilies)(
    "rejects the entire $name response with one malformed entry",
    async ({ entry, page, read }) => {
      const entries = [entry, { ...entry, _id: 12 }];
      await expect(
        read(respondingClient(page ? { entries } : entries)),
      ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it("rejects an empty Thread ID", async () => {
    await expect(
      respondingClient([{ ...detail.thread, _id: "" }]).listOpenThreads(),
    ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
  });

  it.each(responseFamilies.filter(({ page }) => page))(
    "rejects malformed $name cursors",
    async ({ entry, read }) => {
      for (const nextCursor of [null, 12]) {
        await expect(
          read(respondingClient({ entries: [entry], nextCursor })),
        ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
      }
    },
  );

  it.each([
    {
      _id: "task/1",
      text: "Check",
      date: 1,
      repeat: { kind: "days", every: 0 },
    },
    {
      _id: "task/1",
      text: "Check",
      date: 1,
      repeat: { kind: "weekly", weekdays: [2, 2] },
    },
    { _id: "task/1", text: "Check", repeat: { kind: "days", every: 1 } },
    {
      _id: "task/1",
      text: "Check",
      date: 1,
      repeat: { kind: "weekly", weekdays: [4, 2] },
    },
  ])(
    "preserves shared-shape Repeat values without core validation: %j",
    async (task) => {
      const thread = { ...detail.thread, tasks: [task] };
      await expect(
        respondingClient(thread).completeTask({
          expectedOccurrence: null,
          threadId: "thread" as ThreadId,
          taskId: "task/1" as TaskId,
        }),
      ).resolves.toEqual({ ok: true, value: thread });
    },
  );

  it("accepts shared integer timestamps and order above the safe integer limit", async () => {
    const thread = {
      ...detail.thread,
      createdAt: 9_007_199_254_740_992,
      order: 9_007_199_254_740_992,
      tasks: [{ _id: "task/1", text: "Check", date: 9_007_199_254_740_992 }],
    };
    await expect(respondingClient([thread]).listOpenThreads()).resolves.toEqual(
      { ok: true, value: [thread] },
    );
  });

  it("keeps omitted Thread and detail fields absent while stripping nested legacy fields", async () => {
    const thread = {
      _id: "thread-1",
      title: "Book checkup",
      slug: "book-checkup",
      order: 2,
      state: "open",
      createdAt: 1_600_000_000_000,
    };
    const task = { _id: "task-1", text: "Call clinic" };
    await expect(
      respondingClient({
        thread: { ...thread, revision: 2 },
        privateArea: {},
      }).getThreadDetail({ slug: "book-checkup" }),
    ).resolves.toEqual({ ok: true, value: { thread } });
    await expect(
      respondingClient({
        thread: { ...thread, tasks: [{ ...task, legacyDate: 4 }] },
      }).getThreadDetail({ slug: "book-checkup" }),
    ).resolves.toEqual({
      ok: true,
      value: { thread: { ...thread, tasks: [task] } },
    });
  });

  it.each([
    { thread: { ...detail.thread, summary: null } },
    { thread: { ...detail.thread, areaId: null } },
    { thread: { ...detail.thread, tasks: null } },
    { thread: detail.thread, area: null },
    { thread: { ...detail.thread, tasks: [{ _id: "", text: "Check" }] } },
  ])(
    "rejects null optional Thread fields and empty Task IDs: %j",
    async (body) => {
      await expect(
        respondingClient(body).getThreadDetail({ slug: "book-checkup" }),
      ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it.each([
    {
      field: "followUp",
      entry: note,
      read: (client: ApplicationClient) => client.listOpenNotes(),
    },
    {
      field: "completedAt",
      entry: note,
      read: (client: ApplicationClient) => client.listOpenNotes(),
    },
    {
      field: "updatedAt",
      entry: note,
      read: (client: ApplicationClient) => client.listOpenNotes(),
    },
    {
      field: "completedAt",
      entry: threadNote,
      read: (client: ApplicationClient) =>
        client.listOpenThreadNotes({ threadId: "thread-1" as ThreadId }),
    },
  ])(
    "rejects null optional Note field $field",
    async ({ field, entry, read }) => {
      await expect(
        read(respondingClient([{ ...entry, [field]: null }])),
      ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it.each([0, 4, Number.MAX_SAFE_INTEGER])(
    "returns count %i as a number",
    async (count) => {
      await expect(
        respondingClient({ count, privateCount: 7 }).countOpenNotes(),
      ).resolves.toEqual({ ok: true, value: count });
    },
  );

  it.each([9_007_199_254_740_992, "4", null, 1.5])(
    "rejects count outside the safe integer shape: %j",
    async (count) => {
      await expect(
        respondingClient({ count }).countOpenNotes(),
      ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it.each([
    {
      name: "Area",
      remove: (client: ApplicationClient) =>
        client.removeArea({ areaId: "area-1" as AreaId }),
    },
    {
      name: "Thread",
      remove: (client: ApplicationClient) =>
        client.removeThread({ threadId: "thread-1" as ThreadId }),
    },
    {
      name: "Note",
      remove: (client: ApplicationClient) =>
        client.removeNote({ noteId: "note-1" as NoteId }),
    },
    {
      name: "Thread Note",
      remove: (client: ApplicationClient) =>
        client.removeThreadNote({
          threadNoteId: "thread-note-1" as ThreadNoteId,
        }),
    },
  ])(
    "requires a literal true acknowledgement when removing a $name",
    async ({ remove }) => {
      await expect(
        remove(respondingClient({ acknowledged: true, removedId: "private" })),
      ).resolves.toEqual({ ok: true, value: { acknowledged: true } });
      await expect(
        remove(respondingClient({ acknowledged: false })),
      ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
    },
  );

  it.each([200, 404])("rejects unreadable JSON at HTTP %i", async (status) => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: async () => new Response("{broken", { status }),
    });
    await expect(client.listAreas()).resolves.toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
  });

  it("preserves a valid error at an unmapped HTTP status and strips private fields", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: async () =>
        jsonResponse(
          {
            error: {
              code: "conflict",
              message: "Try again later",
              retryable: true,
              internalId: "private",
            },
            trace: "private",
          },
          418,
        ),
    });
    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: { code: "conflict", message: "Try again later", retryable: true },
    });
  });

  it("sends an optional completion Note and keeps the Thread-only response", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(detail.thread));
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });
    const note = {
      id: "client-note" as ThreadNoteId,
      body: "Called **clinic**",
    };
    expect(
      await client.completeTask({
        expectedOccurrence: null,
        threadId: "thread" as ThreadId,
        taskId: "task" as TaskId,
        timeZone: "UTC",
        note,
      }),
    ).toEqual({ ok: true, value: detail.thread });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string)).toEqual({
      expectedOccurrence: null,
      timeZone: "UTC",
      note,
    });
  });
  it("transports repeating Task commands and preserves Repeat in decoded responses", async () => {
    const repeat = { kind: "weekly" as const, weekdays: [2, 4] };
    const thread = {
      ...detail.thread,
      tasks: [
        { _id: "task/1", text: "Check", date: 1_700_000_000_000, repeat },
      ],
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(thread));
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });
    const command = {
      threadId: "thread/with/slashes" as ThreadId,
      taskId: "task/1" as TaskId,
      timeZone: "America/New_York",
    };
    await expect(client.setTaskRepeat({ ...command, repeat })).resolves.toEqual(
      { ok: true, value: thread },
    );
    await expect(
      client.skipTask({
        ...command,
        expectedOccurrence: thread.tasks[0]!.date,
      }),
    ).resolves.toEqual({
      ok: true,
      value: thread,
    });
    await expect(
      client.completeTask({
        ...command,
        expectedOccurrence: thread.tasks[0]!.date,
      }),
    ).resolves.toEqual({
      ok: true,
      value: thread,
    });
    await expect(
      client.setTaskDate({ ...command, date: thread.tasks[0]!.date }),
    ).resolves.toEqual({ ok: true, value: thread });
    for (const [index, action, method, fields] of [
      [1, "repeat", "PUT", { repeat }],
      [2, "skip", "POST", {}],
      [3, "complete", "POST", {}],
      [4, "date", "PUT", { date: thread.tasks[0]!.date }],
    ] as const) {
      expect(fetchImpl).toHaveBeenNthCalledWith(
        index,
        `https://api.test/v1/threads/thread%2Fwith%2Fslashes/tasks/task%2F1/${action}`,
        expect.objectContaining({ method, credentials: "include" }),
      );
      expect(
        JSON.parse(fetchImpl.mock.calls[index - 1]![1]!.body as string),
      ).toEqual({
        ...fields,
        timeZone: command.timeZone,
        ...(action === "skip" || action === "complete"
          ? { expectedOccurrence: thread.tasks[0]!.date }
          : {}),
      });
    }
  });

  it.each([
    null,
    { kind: "monthly", every: 1 },
    { kind: "days", every: "one" },
    { kind: "weekly", weekdays: [2, "four"] },
  ])("refuses malformed Repeat in a server response %j", async (repeat) => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse({
        ...detail.thread,
        tasks: [{ _id: "task/1", text: "Check", date: 1, repeat }],
      }),
    );
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });
    await expect(
      client.completeTask({
        expectedOccurrence: null,
        threadId: "thread" as ThreadId,
        taskId: "a" as TaskId,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "unexpected" } });
  });

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
        expectedOccurrence: null,
        threadId: "thread/with/slashes" as ThreadId,
        taskId: "task/1" as TaskId,
      }),
    ).resolves.toEqual({ ok: true, value: detail.thread });
    await expect(
      client.focusTask({
        threadId: "thread/with/slashes" as ThreadId,
        taskId: null,
      }),
    ).resolves.toEqual({ ok: true, value: detail.thread });
    await expect(
      client.setTaskDate({
        threadId: "thread/with/slashes" as ThreadId,
        taskId: "task/1" as TaskId,
        date: 1_700_000_000_000,
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
        body: JSON.stringify({ expectedOccurrence: null }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/focus",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ taskId: null }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      "https://api.test/v1/threads/thread%2Fwith%2Fslashes/tasks/task%2F1/date",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ date: 1_700_000_000_000 }),
      }),
    );
  });

  it("ignores the Follow-up date the API still derives for older clients", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ...detail,
          thread: {
            ...detail.thread,
            tasks: [
              { _id: "task/1", text: "Call clinic", date: 1_800_000_000_000 },
            ],
            followUp: 1_800_000_000_000,
          },
        }),
      ),
    });

    const result = await client.getThreadDetail({ slug: "book-checkup" });

    expect(result.ok && result.value.thread).not.toHaveProperty("followUp");
    expect(result.ok && result.value.thread.tasks).toEqual([
      { _id: "task/1", text: "Call clinic", date: 1_800_000_000_000 },
    ]);
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

  it("decodes a public Thread without a revision", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(detail)),
    });
    const result = await client.getThreadDetail({ slug: "book-checkup" });
    expect(result).toEqual({ ok: true, value: detail });
    expect(result.ok && result.value.thread).not.toHaveProperty("revision");
  });
  it("removes a Task without a request body", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(detail.thread));
    const client = createHttpApplicationClient({
      apiBaseUrl: "https://api.test",
      fetchImpl,
    });
    await client.removeTask({
      threadId: "thread" as ThreadId,
      taskId: "task" as TaskId,
    });
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ method: "DELETE" });
    expect(fetchImpl.mock.calls[0]![1]!.body).toBeUndefined();
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
