import { afterEach, describe, expect, it, vi } from "vitest";

import { createVersionAwareFetch } from "../lib/version-aware-fetch";
import { downloadData } from "./download-data";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadData", () => {
  it("saves the API's export under today's local date, with the session cookie", async () => {
    const saved: { name: string; blob: Blob }[] = [];
    let lastBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        lastBlob = blob;
        return "blob:export";
      },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        saved.push({ name: this.download, blob: lastBlob! });
      },
    );
    const fetchImpl = vi.fn(
      async () => new Response('{"format":"vita-os-export"}'),
    );

    await downloadData({
      apiBaseUrl: "http://api.test/",
      monitor: createVersionAwareFetch("old", fetchImpl),
      now: new Date(2026, 9, 5, 23, 30),
    });

    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/v1/export", {
      method: "GET",
      credentials: "include",
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe("vita-os-export-2026-10-05.json");
    await expect(saved[0]!.blob.text()).resolves.toBe(
      '{"format":"vita-os-export"}',
    );
  });

  it("rejects without saving when the API refuses", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await expect(
      downloadData({
        apiBaseUrl: "http://api.test",
        monitor: createVersionAwareFetch(
          "old",
          async () => new Response("{}", { status: 500 }),
        ),
      }),
    ).rejects.toThrow("500");
    expect(click).not.toHaveBeenCalled();
  });
});
