import { env, SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { getSocialProviders } from "../src/platform/auth/auth";

describe("authentication and actor gate", () => {
  it("keeps migrated social providers available when their credentials are configured", () => {
    const providers = getSocialProviders({
      ...env,
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    expect(providers).toMatchObject({
      github: { clientId: "github-id" },
      google: { clientId: "google-id", prompt: "select_account" },
    });
    expect(() =>
      getSocialProviders({ ...env, GITHUB_CLIENT_ID: "incomplete" }),
    ).toThrow("GitHub authentication requires both client ID and secret.");
  });

  it("responds to an allowed-origin application preflight request", async () => {
    const response = await createApp().request(
      "/v1/threads/private-thread",
      {
        method: "OPTIONS",
        headers: {
          origin: env.BROWSER_ORIGIN,
          "access-control-request-method": "GET",
        },
      },
      env,
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
    const response = await createApp({ createScope: createStore }).request(
      "/v1/threads/private-thread",
      undefined,
      env,
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
    const response = await createApp().request(
      "/v1/threads/private-thread",
      {
        headers: { origin: env.BROWSER_ORIGIN },
      },
      env,
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
    const response = await createApp().request(
      "/v1/threads/private-thread",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://attacker.example",
          "access-control-request-method": "GET",
        },
      },
      env,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects a credentialed mutation from a disallowed origin before storage", async () => {
    const signUp = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Origin Guard",
        email: "origin-guard@example.com",
        password: "correct horse battery staple",
      }),
    });
    const createStore = vi.fn();
    const response = await createApp({ createScope: createStore }).request(
      "/v1/threads/private-thread/complete-next-move",
      {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "text/plain",
          cookie: signUp.headers.get("set-cookie") ?? "",
        },
        body: JSON.stringify({ expectedNextMove: null, expectedRevision: 0 }),
      },
      env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthorized",
        message: "Request origin is not allowed.",
        retryable: false,
      },
    });
    expect(createStore).not.toHaveBeenCalled();
  });

  it("requires JSON for an allowed-origin mutation before storage", async () => {
    const createStore = vi.fn();
    const response = await createApp({ createScope: createStore }).request(
      "/v1/threads/private-thread/complete-next-move",
      {
        method: "POST",
        headers: {
          origin: env.BROWSER_ORIGIN,
          "content-type": "text/plain",
        },
        body: JSON.stringify({ expectedNextMove: null, expectedRevision: 0 }),
      },
      env,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation",
        message: "JSON request body required.",
        retryable: false,
      },
    });
    expect(createStore).not.toHaveBeenCalled();
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
    const response = await createApp().request(
      "/v1/threads/private-thread",
      { headers: { cookie: signUp.headers.get("set-cookie") ?? "" } },
      { ...env, DB: failingDatabase },
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
    const response = await createApp({
      createScope() {
        throw new Error("storage connection details must remain private");
      },
    }).request(
      "/v1/threads/private-thread",
      { headers: { cookie: signUp.headers.get("set-cookie") ?? "" } },
      env,
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
});
