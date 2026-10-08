import type { Note, Thread } from "@vita-os/contracts";

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { CallOptions } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

function encodeEvery(value: string): string {
  return Array.from(
    new TextEncoder().encode(value),
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
}

async function missing(path: string, options: CallOptions) {
  expectError(await call(path, options), { status: 404, code: "not_found" });
}

describe("encoded paths preserve authentication and ownership", () => {
  it("keeps encoded Notes private and isolates double-encoded IDs", async () => {
    const owner = await createSession("encoded-note-owner");
    const intruder = await createSession("encoded-note-intruder");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Private note" },
    });
    const path = `/%761/notes/${encodeEvery(note._id)}`;
    await missing(`${path}/body`, {
      method: "PATCH",
      session: intruder,
      body: { body: "Taken" },
    });
    await missing(path, { method: "DELETE", session: intruder });
    const doubleEncoded = encodeEvery(note._id).replace(/%/g, "%25");
    await missing(`/v1/notes/${doubleEncoded}/body`, {
      method: "PATCH",
      session: owner,
      body: { body: "Changed" },
    });
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      expect.objectContaining({ _id: note._id, body: "Private note" }),
    ]);
    // The owner's success proves the refusal came from ownership, not routing.
    expect(
      await succeed<Note>(`${path}/body`, {
        method: "PATCH",
        session: owner,
        body: { body: "Owner edit" },
      }),
    ).toMatchObject({ _id: note._id, body: "Owner edit" });
  });

  it("protects an encoded Thread and Task and leaves refused writes unchanged", async () => {
    const owner = await createSession("encoded-task-owner");
    const intruder = await createSession("encoded-task-intruder");
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Private plan" },
    });
    await succeed(`/v1/threads/${thread._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "private-task", text: "Private" },
    });
    const threadPath = `/v1/threads/${encodeEvery(thread._id)}`;
    const taskPath = `${threadPath}/tasks/${encodeEvery("private-task")}`;
    await missing(`/v1/threads/${encodeEvery(thread.slug)}`, {
      session: intruder,
    });
    await missing(taskPath, {
      method: "PATCH",
      session: intruder,
      body: { text: "Taken" },
    });
    await missing(taskPath, { method: "DELETE", session: intruder });
    const detail = await succeed<{ thread: Thread }>(
      `/v1/threads/${encodeEvery(thread.slug)}`,
      { session: owner },
    );
    expect(detail.thread).toMatchObject({
      _id: thread._id,
      title: "Private plan",
      tasks: [{ _id: "private-task", text: "Private" }],
    });
    const edited = await succeed<Thread>(taskPath, {
      method: "PATCH",
      session: owner,
      body: { text: "Owner edit" },
    });
    expect(edited.tasks).toEqual([{ _id: "private-task", text: "Owner edit" }]);
  });

  it("guards an encoded prefix even when a later escape is malformed", async () => {
    const path = "/%761/notes%ZZ";
    expectError(await call(path), { status: 401, code: "unauthorized" });
    const session = await createSession("malformed-prefix");
    const response = await SELF.fetch(`http://api.test${path}`, {
      method: "POST",
      headers: {
        cookie: session.cookie,
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "Must not be written" }),
    });
    expect(response.status).toBe(403);
    expect((await call(path, { session })).status).toBe(404);
    expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
  });

  it("preserves CORS on an encoded auth prefix carrying a session cookie", async () => {
    const session = await createSession("encoded-auth-cookie");
    const url = "http://api.test/%61pi/auth/get-session";
    const response = await SELF.fetch(url, {
      headers: { cookie: session.cookie, origin: env.BROWSER_ORIGIN },
    });
    // Better Auth receives the original Request and requires its literal base path.
    expect(response.status).toBe(404);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      env.BROWSER_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });
});
