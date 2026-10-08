import type { Note } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { call, createSession, expectError, succeed } from "./sessions";

describe("request-local services", () => {
  it("keeps actors and CORS bindings separate in concurrent requests to one app", async () => {
    const first = await createSession("request-context-first");
    const second = await createSession("request-context-second");
    const app = createApp();
    const responses = await Promise.all(
      [first, second].map((session, index) => {
        const origin = `http://browser-${index}.test`;
        return app.fetch(
          new Request("http://api.test/v1/notes", {
            method: "POST",
            headers: {
              cookie: session.cookie,
              origin,
              "content-type": "application/json",
            },
            body: JSON.stringify({ body: `Actor ${index} note` }),
          }),
          { ...env, BROWSER_ORIGIN: origin },
        );
      }),
    );
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(201);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        `http://browser-${index}.test`,
      );
    }
    const firstNotes = await succeed<Note[]>("/v1/notes", { session: first });
    const secondNotes = await succeed<Note[]>("/v1/notes", {
      session: second,
    });
    expect(firstNotes.map((note) => note.body)).toEqual(["Actor 0 note"]);
    expect(secondNotes.map((note) => note.body)).toEqual(["Actor 1 note"]);
  });

  it("authenticates before decoding a malformed body", async () => {
    expectError(
      await call("/v1/notes", { method: "POST", body: { body: 42 } }),
      {
        status: 401,
        code: "unauthorized",
        message: "Authentication required.",
      },
    );
  });

  it("preserves Better Auth cookies when signing out", async () => {
    const session = await createSession("effect-sign-out");
    const app = createApp();
    const response = await app.fetch(
      new Request("http://api.test/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: session.cookie,
          origin: env.BROWSER_ORIGIN,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expectError(await call("/v1/areas", { session }), {
      status: 401,
      code: "unauthorized",
    });
  });
});
