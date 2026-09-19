import { env, SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";

describe("authentication and actor gate", () => {
  it("responds to an allowed-origin application preflight request", async () => {
    const response = await createApp(env).request(
      "/v1/threads/private-thread",
      {
        method: "OPTIONS",
        headers: {
          origin: env.BROWSER_ORIGIN,
          "access-control-request-method": "GET",
        },
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      env.BROWSER_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("creates a session through the public email authentication flow", async () => {
    const signUp = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct horse battery staple",
      }),
    });

    expect(signUp.status).toBe(200);

    const session = await SELF.fetch("http://api.test/api/auth/get-session", {
      headers: { cookie: signUp.headers.get("set-cookie") ?? "" },
    });

    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({
      user: { email: "ada@example.com" },
    });
  });

  it("rejects an unauthenticated application request before creating storage", async () => {
    const createStore = vi.fn();
    const response = await createApp(env, { createStore }).request(
      "/v1/threads/private-thread",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthorized",
        message: "Authentication required.",
        retryable: false,
      },
    });
    expect(createStore).not.toHaveBeenCalled();
  });

  it("includes credentialed CORS headers on an allowed-origin application rejection", async () => {
    const response = await createApp(env).request(
      "/v1/threads/private-thread",
      {
        headers: { origin: env.BROWSER_ORIGIN },
      },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      env.BROWSER_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("does not grant CORS access to a disallowed application origin", async () => {
    const response = await createApp(env).request(
      "/v1/threads/private-thread",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          "access-control-request-method": "GET",
        },
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a stable response when session lookup fails", async () => {
    const signUp = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Barbara Liskov",
        email: "barbara@example.com",
        password: "correct horse battery staple",
      }),
    });
    expect(signUp.status).toBe(200);
    const failingDatabase = new Proxy(env.DB, {
      get(database, property) {
        if (property === "prepare") {
          return () => {
            throw new Error("database credentials must remain private");
          };
        }

        return Reflect.get(database, property);
      },
    });
    const response = await createApp({ ...env, DB: failingDatabase }).request(
      "/v1/threads/private-thread",
      { headers: { cookie: signUp.headers.get("set-cookie") ?? "" } },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unexpected",
        message: "Unexpected error.",
        retryable: false,
      },
    });
  });

  it("returns a stable response when protected storage construction fails", async () => {
    const signUp = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Grace Hopper",
        email: "grace@example.com",
        password: "correct horse battery staple",
      }),
    });
    const response = await createApp(env, {
      createStore() {
        throw new Error("storage connection details must remain private");
      },
    }).request("/v1/threads/private-thread", {
      headers: { cookie: signUp.headers.get("set-cookie") ?? "" },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unexpected",
        message: "Unexpected error.",
        retryable: false,
      },
    });
  });
});
