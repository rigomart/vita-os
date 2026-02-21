import { describe, expect, it } from "vitest";
import { RESERVED_AREA_SLUGS, validateAreaName } from "./validation";

describe("RESERVED_AREA_SLUGS", () => {
  it("contains expected reserved slugs", () => {
    expect(RESERVED_AREA_SLUGS.has("projects")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("settings")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("sign-in")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("sign-up")).toBe(true);
  });
});

describe("validateAreaName", () => {
  it("accepts a normal area name", () => {
    expect(() => validateAreaName("Work")).not.toThrow();
  });

  it("accepts names that slugify differently from reserved words", () => {
    expect(() => validateAreaName("My Projects List")).not.toThrow();
  });

  it("rejects 'Projects' (case-insensitive via slugify)", () => {
    expect(() => validateAreaName("Projects")).toThrow(
      '"Projects" is reserved',
    );
  });

  it("rejects 'Settings'", () => {
    expect(() => validateAreaName("Settings")).toThrow(
      '"Settings" is reserved',
    );
  });

  it("rejects 'Sign In' (slugifies to sign-in)", () => {
    expect(() => validateAreaName("Sign In")).toThrow('"Sign In" is reserved');
  });

  it("rejects 'Sign Up'", () => {
    expect(() => validateAreaName("Sign Up")).toThrow('"Sign Up" is reserved');
  });
});
