import type { Note, NotePage, Thread } from "@vita-os/contracts";

import { ConflictError, ValidationError } from "@vita-os/core";
import { SELF } from "cloudflare:test";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { RequestScope } from "../src/platform/request-scope";

import { systemClock } from "../src/platform/request-scope";
import { createTestApp } from "./app";
import { call, createSession, expectError, succeed } from "./sessions";

describe("HTTP contract compatibility", () => {
  it("preserves semicolons in paths and opaque record IDs", async () => {
    const session = await createSession("semicolon-path");
    expect((await call("/v1/notes;extra", { session })).status).toBe(404);
    const app = createTestApp({
      createScope: (authenticated) => ({
        ...authenticated,
        clock: { now: () => 100, newId: () => "opaque;note" },
      }),
    });
    const created = await app.request(
      "/v1/notes",
      {
        method: "POST",
        headers: { cookie: session.cookie, "content-type": "application/json" },
        body: JSON.stringify({ body: "Before" }),
      },
      env,
    );
    expect(created.status).toBe(201);
    const updated = await app.request(
      "/v1/notes/opaque;note/body",
      {
        method: "PATCH",
        headers: { cookie: session.cookie, "content-type": "application/json" },
        body: JSON.stringify({ body: "After" }),
      },
      env,
    );
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      _id: "opaque;note",
      body: "After",
    });
  });

  it("answers an unreadable body with the endpoint's validation message", async () => {
    const session = await createSession("unreadable-body");
    const response = await createTestApp().request(
      "/v1/notes",
      {
        method: "POST",
        headers: { cookie: session.cookie, "content-type": "application/json" },
        body: new ReadableStream({
          start(controller) {
            controller.error(new Error("Private stream details"));
          },
        }),
      },
      env,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "validation", message: "Invalid Note.", retryable: false },
    });
  });

  it("keeps route matching exact so alternate casing cannot bypass mutation guards", async () => {
    const session = await createSession("exact-paths");
    const response = await SELF.fetch("http://api.test/V1/notes", {
      method: "POST",
      headers: {
        cookie: session.cookie,
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "Must not be written" }),
    });
    expect(response.status).toBe(404);
    expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
    for (const path of ["/v1/notes/", "/v1//notes"]) {
      expect((await call(path, { session })).status).toBe(404);
    }
  });

  it("applies mutation guards when the application prefix is percent encoded", async () => {
    const session = await createSession("encoded-prefix");
    const response = await SELF.fetch("http://api.test/%76%31/notes", {
      method: "POST",
      headers: {
        cookie: session.cookie,
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "Must not be written" }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "unauthorized",
        message: "Request origin is not allowed.",
      },
    });
    expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
  });

  it("can read a Thread whose generated slug exceeds the router's default length", async () => {
    const session = await createSession("long-thread-slug");
    const title = "a".repeat(100);
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session,
      body: { title },
    });
    expect(thread.slug.length).toBeGreaterThan(100);
    const detail = await succeed<{ thread: Thread }>(
      `/v1/threads/${thread.slug}`,
      { session },
    );
    expect(detail.thread._id).toBe(thread._id);
    expect(detail.thread.title).toBe(title);
  });

  it("authenticates unknown application routes before answering not found", async () => {
    expectError(await call("/v1/no-such-route"), {
      status: 401,
      code: "unauthorized",
    });
    const session = await createSession("unknown-route");
    expect((await call("/v1/no-such-route", { session })).status).toBe(404);
  });

  it("uses the first repeated page parameter and ignores unrelated query keys", async () => {
    const session = await createSession("repeated-query");
    for (const body of ["First", "Second"]) {
      const note = await succeed<Note>("/v1/notes", {
        method: "POST",
        body: { body },
        session,
      });
      await succeed(`/v1/notes/${note._id}/state`, {
        method: "PATCH",
        body: { state: "done" },
        session,
      });
    }
    const page = await succeed<NotePage>(
      "/v1/notes/done?limit=1&limit=0&unrelated=kept",
      { session },
    );
    expect(page.entries).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it.each([undefined, "text/plain"])(
    "accepts a Task DELETE JSON body with content type %s",
    async (contentType) => {
      const session = await createSession("delete-content-type");
      const thread = await succeed<Thread>("/v1/threads", {
        method: "POST",
        body: { title: "Remove task" },
        session,
      });
      await succeed<Thread>(`/v1/threads/${thread._id}/tasks`, {
        method: "POST",
        session,
        body: {
          taskId: "task",
          text: "Remove me",
        },
      });
      const response = await SELF.fetch(
        `http://api.test/v1/threads/${thread._id}/tasks/task`,
        {
          method: "DELETE",
          headers: {
            cookie: session.cookie,
            ...(contentType === undefined
              ? {}
              : { "content-type": contentType }),
          },
          body: JSON.stringify({ expectedOccurrence: null }),
        },
      );
      expect(response.status).toBe(200);
      const written = await response.json();
      expect(written).not.toHaveProperty("tasks");
      const reopened = await succeed<{ thread: Thread }>(
        `/v1/threads/${thread.slug}`,
        { session },
      );
      expect(reopened.thread).not.toHaveProperty("tasks");
    },
  );

  it("answers malformed JSON with the endpoint's public validation message", async () => {
    const session = await createSession("malformed-json");
    const response = await SELF.fetch("http://api.test/v1/notes", {
      method: "POST",
      headers: { cookie: session.cookie, "content-type": "application/json" },
      body: "{",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "validation", message: "Invalid Note.", retryable: false },
    });
    expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
  });

  it.each([
    {
      thrown: new ValidationError("Escaped validation"),
      status: 400,
      code: "validation",
    },
    {
      thrown: new ConflictError("Escaped conflict"),
      status: 409,
      code: "conflict",
    },
  ])(
    "refuses a $code rule that throws outside the typed channel in its own words",
    async ({ thrown, status, code }) => {
      const session = await createSession(`escaped-${code}`);
      // Thread creation builds its storage outside any typed boundary, so a
      // throwing scope reaches the response as a defect.
      const app = createTestApp({
        createScope: ({ actorId }) => ({
          actorId,
          clock: systemClock,
          get db(): RequestScope["db"] {
            throw thrown;
          },
        }),
      });
      const response = await app.request(
        "/v1/threads",
        {
          method: "POST",
          headers: {
            cookie: session.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ title: "Escaping" }),
        },
        env,
      );
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        error: { code, message: thrown.message, retryable: false },
      });
    },
  );

  it("serves HEAD through GET while omitting the body", async () => {
    const session = await createSession("head-fallback");
    const response = await SELF.fetch("http://api.test/v1/notes", {
      method: "HEAD",
      headers: { cookie: session.cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).toBe("");
  });
});
