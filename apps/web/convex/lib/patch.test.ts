import { describe, expect, it } from "vitest";
import { nullsToUndefined } from "./patch";

describe("nullsToUndefined", () => {
  it("converts null values to undefined", () => {
    const result = nullsToUndefined({ a: null, b: "hello" });
    expect(result).toEqual({ a: undefined, b: "hello" });
  });

  it("preserves non-null values", () => {
    const result = nullsToUndefined({ a: 1, b: "two", c: true });
    expect(result).toEqual({ a: 1, b: "two", c: true });
  });

  it("preserves undefined values (absent keys stay absent)", () => {
    const obj: { a?: string | null } = {};
    const result = nullsToUndefined(obj);
    expect("a" in result).toBe(false);
  });

  it("returns empty object for empty input", () => {
    expect(nullsToUndefined({})).toEqual({});
  });

  it("handles multiple null fields", () => {
    const result = nullsToUndefined({ a: null, b: null, c: "keep" });
    expect(result).toEqual({ a: undefined, b: undefined, c: "keep" });
  });
});
