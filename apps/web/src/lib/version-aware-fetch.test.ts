import { createHttpApplicationClient } from "@vita-os/contracts/http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVersionAwareFetch } from "./version-aware-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("version-aware fetch", () => {
  it("observes application responses before the HTTP client rejects their old shape", async () => {
    const monitor = createVersionAwareFetch(
      "old",
      async () =>
        new Response("invalid JSON", { headers: { "X-Vita-Version": "new" } }),
    );
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: monitor.fetch,
    });
    const result = await client.listAreas();
    expect(result.ok).toBe(false);
    expect(monitor.getState().targetVersion).toBe("new");
  });
  it("observes the header before anyone decodes an incompatible response", async () => {
    const response = new Response("not valid JSON", {
      headers: { "X-Vita-Version": "new" },
    });
    const monitor = createVersionAwareFetch("old", async () => response);
    expect(await monitor.fetch("http://api.test/v1/threads")).toBe(response);
    expect(monitor.getState().targetVersion).toBe("new");
    await expect(response.json()).rejects.toThrow();
  });

  it.each([undefined, "", "   ", "old"])(
    "does nothing for version %s",
    async (version) => {
      const monitor = createVersionAwareFetch(
        "old",
        async () =>
          new Response(null, {
            headers: version === undefined ? {} : { "X-Vita-Version": version },
          }),
      );
      await monitor.fetch("http://api.test/v1/threads");
      expect(monitor.getState().targetVersion).toBeUndefined();
    },
  );

  it("disables reload tracking without a bundled version", async () => {
    const monitor = createVersionAwareFetch(
      "  ",
      async () => new Response(null, { headers: { "X-Vita-Version": "new" } }),
    );
    await monitor.fetch("http://api.test/v1/threads");
    expect(monitor.getState().targetVersion).toBeUndefined();
  });

  it("tracks writes until their fetch settles, including Request methods and errors", async () => {
    let finish!: (response: Response) => void;
    const monitor = createVersionAwareFetch(
      "old",
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = monitor.fetch(
      new Request("http://api.test/api/auth/sign-out", { method: "POST" }),
    );
    expect(monitor.getState().activeWrites).toBe(1);
    finish(new Response());
    await pending;
    expect(monitor.getState().activeWrites).toBe(0);
    const failing = createVersionAwareFetch("old", async () => {
      throw new Error("offline");
    });
    await expect(
      failing.fetch("http://api.test/v1/threads", { method: "PATCH" }),
    ).rejects.toThrow("offline");
    expect(failing.getState().activeWrites).toBe(0);
  });

  it("wires the real Better Auth client to the shared version observer", async () => {
    vi.stubEnv("VITE_APP_VERSION", "old");
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("null", {
          headers: {
            "content-type": "application/json",
            "X-Vita-Version": "new",
          },
        }),
    );
    const { authClient } = await import("./auth-client");
    const { versionAwareFetch } = await import("./version-aware-fetch");
    await authClient.getSession();
    expect(versionAwareFetch.getState().targetVersion).toBe("new");
  });
});
