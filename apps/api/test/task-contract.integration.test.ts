import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { createSession, succeed } from "./sessions";

async function createThread(session: Session): Promise<Thread> {
  return succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Book checkup" },
  });
}

async function logOf(session: Session, thread: Thread) {
  const page = await succeed<ActivityLogPage>(
    `/v1/threads/${thread._id}/activity`,
    { session },
  );
  return page.entries.map((entry) => [entry.type, entry.content]);
}

describe("Task HTTP contract", () => {
  it("adds, edits, focuses, completes and removes a Task", async () => {
    const owner = await createSession("tasks-routes");
    const created = await createThread(owner);
    const base = `/v1/threads/${created._id}`;

    let thread = await succeed<Thread>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic" },
    });
    thread = await succeed<Thread>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: {
        taskId: "b",
        text: "Book slot",
      },
    });
    thread = await succeed<Thread>(`${base}/tasks/b`, {
      method: "PATCH",
      session: owner,
      body: { text: "Book a slot" },
    });
    thread = await succeed<Thread>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "b" },
    });
    expect(thread.tasks).toEqual([
      { _id: "a", text: "Call clinic" },
      { _id: "b", text: "Book a slot" },
    ]);
    expect(thread.focusedTaskId).toBe("b");

    thread = await succeed<Thread>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: null },
    });
    expect(thread).not.toHaveProperty("focusedTaskId");
    expect(thread).not.toHaveProperty("focusedMoveId");

    thread = await succeed<Thread>(`${base}/tasks/a/complete`, {
      method: "POST",
      session: owner,
      body: { expectedOccurrence: null },
    });
    expect(thread.tasks).toEqual([{ _id: "b", text: "Book a slot" }]);
    expect(await logOf(owner, thread)).toEqual([
      ["move_completed", 'Completed "Call clinic"'],
    ]);

    thread = await succeed<Thread>(`${base}/tasks/b`, {
      method: "DELETE",
      session: owner,
      body: {},
    });
    expect(thread).not.toHaveProperty("tasks");
    expect(thread).not.toHaveProperty("moves");
  });

  it.each([-1, 253_402_300_800_000])(
    "completes a legacy stored Task date outside new-write bounds: %s",
    async (date) => {
      const owner = await createSession("tasks-legacy-date");
      const thread = await createThread(owner);
      await env.DB.prepare("UPDATE threads SET moves_json = ? WHERE id = ?")
        .bind(
          JSON.stringify([{ id: "legacy", text: "Legacy task", date }]),
          thread._id,
        )
        .run();
      const detail = await succeed<{ thread: Thread }>(
        `/v1/threads/${thread.slug}`,
        { session: owner },
      );
      expect(detail.thread.tasks?.[0]?.date).toBe(date);
      const completed = await succeed<Thread>(
        `/v1/threads/${thread._id}/tasks/legacy/complete`,
        { method: "POST", session: owner, body: { expectedOccurrence: date } },
      );
      expect(completed).not.toHaveProperty("tasks");
      expect(await logOf(owner, thread)).toEqual([
        ["move_completed", 'Completed "Legacy task"'],
      ]);
    },
  );

  it("stores Tasks in the unchanged columns", async () => {
    const owner = await createSession("tasks-routes-storage");
    const created = await createThread(owner);
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic" },
    });
    await succeed(`/v1/threads/${created._id}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "a" },
    });

    expect(
      await env.DB.prepare(
        "SELECT moves_json, focused_move_id FROM threads WHERE id = ?",
      )
        .bind(created._id)
        .first(),
    ).toEqual({
      moves_json: '[{"id":"a","text":"Call clinic"}]',
      focused_move_id: "a",
    });
  });
});
