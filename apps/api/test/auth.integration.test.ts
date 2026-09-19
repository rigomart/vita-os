import { env, SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";

describe("authentication and actor gate", () => {
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
});
