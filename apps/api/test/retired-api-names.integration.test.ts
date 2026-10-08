import type { Note, Thread, ThreadDetail } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { call, createSession, expectError, succeed } from "./sessions";

describe("current API request and response values", () => {
  it("refuses unknown Thread fields without changing the Thread", async () => {
    const owner = await createSession("retired-thread-follow-up");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    for (const extra of [{ unknown: 123 }]) {
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

  it("requires Task IDs on Task and focus routes without changing the Thread", async () => {
    const owner = await createSession("retired-task-id");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    for (const [path, method, body] of [
      ["tasks", "POST", { text: "Missing ID" }],
      ["focus", "PUT", {}],
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

  it("refuses unknown Note fields on capture and dating without changing Notes", async () => {
    const owner = await createSession("retired-note-date-field");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Call", followUp: 123 },
    });
    for (const extra of [{ unknown: 456 }]) {
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
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      note,
    ]);
  });

  it("returns dated Task and focus values", async () => {
    const owner = await createSession("retired-response-aliases");
    const created = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Checkup" },
    });
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call", date: 123 },
    });
    const focused = await succeed<Thread>(`/v1/threads/${created._id}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "a" },
    });
    const detail = await succeed<ThreadDetail>(`/v1/threads/${created.slug}`, {
      session: owner,
    });
    const open = await succeed<Thread[]>("/v1/threads", { session: owner });
    for (const thread of [focused, detail.thread, ...open]) {
      expect(thread.tasks).toEqual([{ _id: "a", text: "Call", date: 123 }]);
      expect(thread.focusedTaskId).toBe("a");
    }
  });

  it("returns the Follow-up date for dated Notes", async () => {
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
    }
  });
});
