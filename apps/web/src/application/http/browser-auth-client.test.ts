import { describe, expect, it, vi } from "vitest";

const { createAuthClient } = vi.hoisted(() => ({ createAuthClient: vi.fn() }));

vi.mock("better-auth/react", () => ({ createAuthClient }));

import { createBrowserAuthClient } from "./browser-auth-client";

describe("createBrowserAuthClient", () => {
  it("creates a plain Better Auth browser client for the Worker URL", () => {
    const client = { signIn: {} };
    createAuthClient.mockReturnValue(client);

    expect(createBrowserAuthClient("https://api.test/")).toBe(client);
    expect(createAuthClient).toHaveBeenCalledWith({
      baseURL: "https://api.test/",
    });
  });
});
