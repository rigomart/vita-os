import type { Note, Thread, ThreadDetail } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { call, createSession, expectError, succeed } from "./sessions";

describe("retired API names", () => {
  it.each([
    ["POST", "moves"],
    ["PATCH", "moves/a"],
    ["DELETE", "moves/a"],
    ["POST", "moves/a/complete"],
  ] as const)("returns 404 for %s /%s", async (method, path) => {
    const owner = await createSession("retired-moves-route");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    await succeed(`/v1/threads/${thread._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call", expectedRevision: 0 },
    });
    expect(
      (
        await call(`/v1/threads/${thread._id}/${path}`, {
          method,
          session: owner,
          body:
            path === "moves"
              ? { moveId: "b", text: "Book", expectedRevision: 1 }
              : {
                  ...(method === "PATCH" ? { text: "Call" } : {}),
                  expectedRevision: 1,
                },
        })
      ).status,
    ).toBe(404);
  });

  it("refuses Thread followUp like any unknown field, without changing the Thread", async () => {
    const owner = await createSession("retired-thread-follow-up");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    for (const extra of [
      { followUp: 123 },
      { followUp: null },
      { unknown: 123 },
    ]) {
      expectError(
        await call(`/v1/threads/${thread._id}`, {
          method: "PATCH",
          session: owner,
          body: { title: "Changed", ...extra },
        }),
        { status: 400, code: "validation", message: "Invalid Thread change." },
      );
    }
    expect(
      (
        await succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, {
          session: owner,
        })
      ).thread,
    ).toEqual(thread);
  });

  it("refuses moveId on current Task and focus routes as an unknown field", async () => {
    const owner = await createSession("retired-task-id");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    for (const [path, method, body] of [
      ["tasks", "POST", { moveId: "a", text: "Call", expectedRevision: 0 }],
      [
        "tasks",
        "POST",
        { taskId: "a", moveId: "a", text: "Call", expectedRevision: 0 },
      ],
      ["focus", "PUT", { moveId: null, expectedRevision: 0 }],
      ["focus", "PUT", { taskId: null, moveId: null, expectedRevision: 0 }],
      ["tasks", "POST", { text: "Missing ID", expectedRevision: 0 }],
      ["focus", "PUT", { expectedRevision: 0 }],
    ] as const) {
      expectError(
        await call(`/v1/threads/${thread._id}/${path}`, {
          method,
          session: owner,
          body,
        }),
        { status: 400, code: "validation", message: "Invalid Task change." },
      );
    }
    expect(
      (
        await succeed<ThreadDetail>(`/v1/threads/${thread.slug}`, {
          session: owner,
        })
      ).thread,
    ).toEqual(thread);
  });

  it("refuses Note attentionDate like any unknown field on capture and dating", async () => {
    const owner = await createSession("retired-note-date-field");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Call", followUp: 123 },
    });
    for (const extra of [{ attentionDate: 456 }, { unknown: 456 }]) {
      expectError(
        await call("/v1/notes", {
          method: "POST",
          session: owner,
          body: { body: "Another", ...extra },
        }),
        { status: 400, code: "validation", message: "Invalid Note." },
      );
      expectError(
        await call(`/v1/notes/${note._id}/follow-up`, {
          method: "PATCH",
          session: owner,
          body: { followUp: 456, ...extra },
        }),
        { status: 400, code: "validation", message: "Invalid Follow-up date." },
      );
    }
    for (const attentionDate of [456, null]) {
      expectError(
        await call(`/v1/notes/${note._id}/follow-up`, {
          method: "PATCH",
          session: owner,
          body: { attentionDate },
        }),
        { status: 400, code: "validation", message: "Invalid Follow-up date." },
      );
    }
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      note,
    ]);
  });

  it("returns 404 for the attention-date route", async () => {
    const owner = await createSession("retired-note-date-route");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Call" },
    });
    expect(
      (
        await call(`/v1/notes/${note._id}/attention-date`, {
          method: "PATCH",
          session: owner,
          body: { attentionDate: 123 },
        })
      ).status,
    ).toBe(404);
  });

  it("returns only current names for dated Tasks and focus", async () => {
    const owner = await createSession("retired-response-aliases");
    const created = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call", date: 123, expectedRevision: 0 },
    });
    const focused = await succeed<Thread>(`/v1/threads/${created._id}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "a", expectedRevision: 1 },
    });
    const detail = await succeed<ThreadDetail>(`/v1/threads/${created.slug}`, {
      session: owner,
    });
    const open = await succeed<Thread[]>("/v1/threads", { session: owner });
    for (const thread of [focused, detail.thread, ...open]) {
      expect(thread.tasks).toEqual([{ _id: "a", text: "Call", date: 123 }]);
      expect(thread.focusedTaskId).toBe("a");
      for (const name of ["moves", "focusedMoveId", "followUp"])
        expect(thread).not.toHaveProperty(name);
    }
  });

  it("returns only followUp for dated Notes", async () => {
    const owner = await createSession("retired-note-response-alias");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Call", followUp: 123 },
    });
    for (const value of [
      note,
      ...(await succeed<Note[]>("/v1/notes", { session: owner })),
    ]) {
      expect(value.followUp).toBe(123);
      expect(value).not.toHaveProperty("attentionDate");
    }
  });
});
