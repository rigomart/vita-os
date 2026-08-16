import { afterEach, describe, expect, it, vi } from "vitest";

import { isApplePlatform } from "./platform";

afterEach(() => vi.unstubAllGlobals());

describe("isApplePlatform", () => {
  it("reads userAgentData first", () => {
    vi.stubGlobal("navigator", {
      userAgentData: { platform: "macOS" },
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
    });

    expect(isApplePlatform()).toBe(true);
  });

  it.each(["MacIntel", "iPhone", "iPad"])(
    "falls back to the deprecated platform string (%s)",
    (platform) => {
      vi.stubGlobal("navigator", { platform });

      expect(isApplePlatform()).toBe(true);
    },
  );

  it("falls back to the user agent when the platform strings are empty", () => {
    vi.stubGlobal("navigator", {
      userAgentData: { platform: "" },
      platform: "",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });

    expect(isApplePlatform()).toBe(true);
  });

  it("reports non-Apple for Windows, Linux and an empty navigator", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(isApplePlatform()).toBe(false);

    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    });
    expect(isApplePlatform()).toBe(false);

    vi.stubGlobal("navigator", {});
    expect(isApplePlatform()).toBe(false);
  });

  it("survives an environment with no navigator at all", () => {
    vi.stubGlobal("navigator", undefined);

    expect(isApplePlatform()).toBe(false);
  });
});
