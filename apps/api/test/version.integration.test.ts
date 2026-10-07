import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createTestApp } from "./app";

describe("deployment version", () => {
  it.each([
    ["/v1/threads/private", "GET", 401],
    ["/v1/threads/private", "POST", 415],
    ["/v1/threads/private", "OPTIONS", 204],
    ["/api/auth/get-session", "GET", 200],
    ["/missing", "GET", 404],
  ])(
    "marks %s %s responses without changing status",
    async (path, method, status) => {
      const response = await createTestApp().request(
        path,
        {
          method,
          headers: { origin: env.BROWSER_ORIGIN },
        },
        { ...env, APP_VERSION: "deployment-sha" },
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("X-Vita-Version")).toBe("deployment-sha");
      if (path !== "/missing")
        expect(response.headers.get("access-control-expose-headers")).toContain(
          "X-Vita-Version",
        );
    },
  );

  it("preserves auth session cookies while adding the version header", async () => {
    const response = await createTestApp().request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Version Cookie",
          email: "version-cookie@example.com",
          password: "correct horse battery staple",
        }),
      },
      { ...env, APP_VERSION: "deployment-sha" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Vita-Version")).toBe("deployment-sha");
    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);
    const session = await createTestApp().request(
      "/api/auth/get-session",
      { headers: { cookie: cookies.join("; ") } },
      env,
    );
    expect(session.headers.get("X-Vita-Version")).toBe("");
    const missing = await createTestApp().request(
      "/v1/no-such-route",
      { headers: { cookie: cookies.join("; "), origin: env.BROWSER_ORIGIN } },
      { ...env, APP_VERSION: "deployment-sha" },
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("X-Vita-Version")).toBe("deployment-sha");
    expect(missing.headers.get("access-control-expose-headers")).toContain(
      "X-Vita-Version",
    );
    await expect(session.json()).resolves.toMatchObject({
      user: { email: "version-cookie@example.com" },
    });
  });
});
