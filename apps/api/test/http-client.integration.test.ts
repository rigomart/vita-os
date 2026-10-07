import type { TaskId, ThreadId } from "@vita-os/contracts";

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createHttpApplicationClient } from "../../web/src/application/http/http-application-client";
import worker from "../src/worker";

type Session = { actorId: string; cookie: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSignedUpUserId(value: unknown): string {
  if (!isObject(value) || !isObject(value.user)) {
    throw new Error("Better Auth returned an invalid sign-up response");
  }

  const { id } = value.user;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Better Auth sign-up response omitted the user ID");
  }

  return id;
}

async function createSession(): Promise<Session> {
  const response = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "HTTP client owner",
      email: `http-client-${crypto.randomUUID()}@example.com`,
      password: "correct horse battery staple",
    }),
  });

  expect(response.status).toBe(200);
  const actorId = readSignedUpUserId(await response.json());
  const cookie = response.headers.get("set-cookie");
  expect(cookie).toEqual(expect.any(String));
  if (cookie === null || cookie.length === 0) {
    throw new Error("Better Auth sign-up response omitted the session cookie");
  }

  return {
    actorId,
    cookie,
  };
}

async function seedThread(owner: Session): Promise<{
  id: ThreadId;
  slug: string;
}> {
  const suffix = crypto.randomUUID();
  const areaId = `http-client-area-${suffix}`;
  const id = `http-client-thread-${suffix}`;
  const slug = `http-client-thread-${suffix}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO areas (id, user_id, name, slug, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      areaId,
      owner.actorId,
      "Family Health",
      `family-health-${suffix}`,
      "Compass",
      1,
      1_600_000_000_000,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, moves_json, focused_move_id, created_at, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      id,
      owner.actorId,
      areaId,
      "Book checkup",
      slug,
      "Choose a clinic",
      1,
      "open",
      '[{"id":"task-1","text":"Call clinic"}]',
      "task-1",
      1_600_000_000_001,
      0,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      `http-client-log-${suffix}`,
      owner.actorId,
      id,
      "next_move_change",
      "Captured a Next Move",
      null,
      "Call clinic",
      1_600_000_000_002,
    ),
  ]);

  return { id: id as ThreadId, slug };
}

function authenticatedWorkerFetch(cookie: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    return worker.fetch(new Request(input, { ...init, headers }), env);
  };
}

describe("HTTP ApplicationClient against the Worker", () => {
  it("finds resolved Threads and removes reopened Threads from that list without restoring attention", async () => {
    const owner = await createSession();
    const thread = await seedThread(owner);
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: authenticatedWorkerFetch(owner.cookie),
    });
    const dated = await client.setTaskDate({
      threadId: thread.id,
      taskId: "task-1" as TaskId,
      date: 1_800_000_000_000,
    });
    expect(dated.ok).toBe(true);
    await expect(client.listResolvedThreads()).resolves.toEqual({
      ok: true,
      value: [],
    });
    const resolved = await client.updateThread({
      threadId: thread.id,
      state: "resolved",
    });
    expect(resolved.ok).toBe(true);
    await expect(client.listResolvedThreads()).resolves.toEqual({
      ok: true,
      value: [expect.objectContaining({ _id: thread.id, state: "resolved" })],
    });
    const reopened = await client.updateThread({
      threadId: thread.id,
      state: "open",
    });
    expect(reopened.ok).toBe(true);
    expect(reopened.ok && reopened.value).not.toHaveProperty("followUp");
    expect(reopened.ok && reopened.value).not.toHaveProperty("tasks");
    expect(reopened.ok && reopened.value).not.toHaveProperty("focusedTaskId");
    await expect(client.listResolvedThreads()).resolves.toEqual({
      ok: true,
      value: [],
    });
  });

  it("uses the Better Auth cookie for detail, Activity Log, completion, not-found, and conflict", async () => {
    const owner = await createSession();
    const thread = await seedThread(owner);
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: authenticatedWorkerFetch(owner.cookie),
    });

    await expect(
      client.getThreadDetail({ slug: thread.slug }),
    ).resolves.toEqual({
      ok: true,
      value: {
        thread: expect.objectContaining({
          _id: thread.id,
          tasks: [{ _id: "task-1", text: "Call clinic" }],
          focusedTaskId: "task-1",
        }),
        area: expect.objectContaining({ name: "Family Health" }),
      },
    });
    await expect(
      client.getThreadActivityPage({ threadId: thread.id, limit: 1 }),
    ).resolves.toEqual({
      ok: true,
      value: {
        entries: [
          expect.objectContaining({
            content: "Captured a Next Move",
            newValue: "Call clinic",
          }),
        ],
      },
    });
    const completed = await client.completeTask({
      expectedOccurrence: null,
      threadId: thread.id,
      taskId: "task-1" as TaskId,
    });
    expect(completed.ok).toBe(true);
    expect(completed.ok && completed.value).not.toHaveProperty("tasks");
    expect(completed.ok && completed.value).not.toHaveProperty("focusedTaskId");
    await expect(
      client.getThreadActivityPage({ threadId: thread.id, limit: 1 }),
    ).resolves.toEqual({
      ok: true,
      value: {
        entries: [
          expect.objectContaining({
            type: "move_completed",
            content: 'Completed "Call clinic"',
          }),
        ],
        nextCursor: expect.any(String),
      },
    });
    await expect(
      client.getThreadDetail({ slug: "missing-thread" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Thread not found.",
        retryable: false,
      },
    });
    await expect(
      client.completeTask({
        expectedOccurrence: null,
        threadId: thread.id,
        taskId: "task-1" as TaskId,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "The Thread's Tasks have changed.",
        retryable: false,
      },
    });
  });
});
