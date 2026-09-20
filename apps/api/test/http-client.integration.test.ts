import type { ThreadId } from "@vita-os/contracts";

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createHttpApplicationClient } from "../../web/src/application/http/http-application-client";
import worker from "../src/worker";

type Session = { actorId: string; cookie: string };

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
  const body = (await response.json()) as { user: { id: string } };
  return {
    actorId: body.user.id,
    cookie: response.headers.get("set-cookie") ?? "",
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
      "INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      areaId,
      owner.actorId,
      "Family Health",
      `family-health-${suffix}`,
      null,
      "healthy",
      "Compass",
      1,
      1_600_000_000_000,
    ),
    env.DB.prepare(
      "INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, next_move, created_at, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      id,
      owner.actorId,
      areaId,
      "Book checkup",
      slug,
      "Choose a clinic",
      1,
      "open",
      "Call clinic",
      1_600_000_000_001,
      0,
    ),
    env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      `http-client-log-${suffix}`,
      owner.actorId,
      id,
      "next_action_change",
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
          nextMove: "Call clinic",
          revision: 0,
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
    await expect(
      client.completeNextMove({
        threadId: thread.id,
        expectedNextMove: "Call clinic",
        expectedRevision: 0,
      }),
    ).resolves.toEqual({ ok: true, value: { status: "completed" } });
    await expect(
      client.getThreadActivityPage({ threadId: thread.id, limit: 1 }),
    ).resolves.toEqual({
      ok: true,
      value: {
        entries: [
          expect.objectContaining({
            content: 'Completed "Call clinic" — next move cleared',
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
      client.completeNextMove({
        threadId: thread.id,
        expectedNextMove: "Call clinic",
        expectedRevision: 0,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "Next Move has changed.",
        retryable: false,
      },
    });
  });
});
