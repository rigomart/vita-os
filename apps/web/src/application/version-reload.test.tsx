import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVersionAwareFetch } from "../lib/version-aware-fetch";
import { VersionReload } from "./version-reload";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(
  fetchManifest = vi.fn<typeof fetch>(async () =>
    Response.json({ version: "new" }),
  ),
) {
  const monitor = createVersionAwareFetch(
    "old",
    async () => new Response(null, { headers: { "X-Vita-Version": "new" } }),
  );
  const queryClient = new QueryClient();
  const reload = vi.fn();
  const mount = () =>
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <VersionReload
            monitor={monitor}
            fetchManifest={fetchManifest}
            reload={reload}
          />
        </QueryClientProvider>
      </StrictMode>,
    );
  return { monitor, queryClient, reload, fetchManifest, mount };
}
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("version reload", () => {
  it("does not poll before a mismatch, then reloads once when the web version is ready", async () => {
    vi.useFakeTimers();
    const test = setup();
    test.mount();
    await tick();
    expect(test.fetchManifest).not.toHaveBeenCalled();
    await act(async () => {
      await test.monitor.fetch("http://api.test/v1/threads");
    });
    expect(test.fetchManifest).toHaveBeenCalledWith("/version.json", {
      cache: "no-store",
    });
    expect(test.reload).toHaveBeenCalledTimes(1);
    await tick();
    expect(test.reload).toHaveBeenCalledTimes(1);
  });

  it("keeps a mismatch seen before mounting and does not reload twice across remounts", async () => {
    vi.useFakeTimers();
    const test = setup();
    await test.monitor.fetch("http://api.test/api/auth/get-session");
    await act(async () => {
      test.mount();
    });
    expect(test.reload).toHaveBeenCalledTimes(1);
    cleanup();
    await act(async () => {
      test.mount();
    });
    expect(test.reload).toHaveBeenCalledTimes(1);
  });

  it("retries stale, malformed, unavailable, and unsuccessful manifests", async () => {
    vi.useFakeTimers();
    const fetchManifest = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ version: "old" }))
      .mockResolvedValueOnce(new Response("bad json"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ version: "new" }, { status: 503 }))
      .mockResolvedValue(Response.json({ version: "new" }));
    const test = setup(fetchManifest);
    test.mount();
    await act(async () => {
      await test.monitor.fetch("http://api.test/v1/threads");
    });
    for (let i = 0; i < 3; i++) {
      await tick();
      expect(test.reload).not.toHaveBeenCalled();
    }
    await tick();
    expect(test.reload).toHaveBeenCalledTimes(1);
  });

  it("waits for a queued mutation and an asynchronous onSettled callback", async () => {
    vi.useFakeTimers();
    const test = setup();
    const command = deferred<void>();
    const settled = deferred<void>();
    const queued = deferred<void>();
    const first = test.queryClient
      .getMutationCache()
      .build(test.queryClient, {
        scope: { id: "thread" },
        mutationFn: () => command.promise,
        onSettled: () => settled.promise,
      })
      .execute(undefined);
    const second = test.queryClient
      .getMutationCache()
      .build(test.queryClient, {
        scope: { id: "thread" },
        mutationFn: () => queued.promise,
      })
      .execute(undefined);
    test.mount();
    await act(async () => {
      await test.monitor.fetch("http://api.test/v1/threads");
    });
    expect(test.reload).not.toHaveBeenCalled();
    await act(async () => {
      command.resolve();
    });
    expect(test.reload).not.toHaveBeenCalled();
    await act(async () => {
      settled.resolve();
      await first;
    });
    expect(test.reload).not.toHaveBeenCalled();
    await act(async () => {
      queued.resolve();
      await second;
    });
    expect(test.reload).toHaveBeenCalledTimes(1);
  });

  it("waits for an auth write outside the QueryClient", async () => {
    vi.useFakeTimers();
    const response = deferred<Response>();
    const monitor = createVersionAwareFetch("old", async (_input, init) =>
      init?.method === "POST"
        ? response.promise
        : new Response(null, { headers: { "X-Vita-Version": "new" } }),
    );
    const test = setup();
    render(
      <QueryClientProvider client={test.queryClient}>
        <VersionReload
          monitor={monitor}
          fetchManifest={test.fetchManifest}
          reload={test.reload}
        />
      </QueryClientProvider>,
    );
    const pending = monitor.fetch("http://api.test/api/auth/sign-out", {
      method: "POST",
    });
    expect(monitor.getState().activeWrites).toBe(1);
    await act(async () => {
      await monitor.fetch("http://api.test/v1/threads");
    });
    expect(test.reload).not.toHaveBeenCalled();
    await act(async () => {
      response.resolve(
        new Response(null, { headers: { "X-Vita-Version": "new" } }),
      );
      await pending;
    });
    expect(test.reload).toHaveBeenCalledTimes(1);
  });

  it("uses the newest API target when an older manifest request is outstanding", async () => {
    vi.useFakeTimers();
    const manifest = deferred<Response>();
    const fetchManifest = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(manifest.promise)
      .mockResolvedValue(Response.json({ version: "newer" }));
    let apiVersion = "new";
    const monitor = createVersionAwareFetch(
      "old",
      async () =>
        new Response(null, { headers: { "X-Vita-Version": apiVersion } }),
    );
    const queryClient = new QueryClient();
    const reload = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <VersionReload
          monitor={monitor}
          fetchManifest={fetchManifest}
          reload={reload}
        />
      </QueryClientProvider>,
    );
    await act(async () => {
      await monitor.fetch("http://api.test/v1/threads");
    });
    apiVersion = "newer";
    await act(async () => {
      await monitor.fetch("http://api.test/v1/threads");
      manifest.resolve(Response.json({ version: "new" }));
    });
    expect(reload).not.toHaveBeenCalled();
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
