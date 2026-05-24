import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-result";

describe("getAuthErrorMessage", () => {
  it("returns the client auth error message when one is present", () => {
    expect(
      getAuthErrorMessage({ error: { message: "Invalid credentials" } }),
    ).toBe("Invalid credentials");
  });

  it("ignores successful or malformed auth results", () => {
    expect(getAuthErrorMessage({ data: { user: { id: "user-1" } } })).toBe(
      null,
    );
    expect(getAuthErrorMessage({ error: { message: "" } })).toBe(null);
    expect(getAuthErrorMessage(null)).toBe(null);
  });
});
