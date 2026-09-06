import { describe, expect, it } from "vitest";

import {
  requireTitle,
  RESERVED_AREA_SLUGS,
  validateAreaName,
} from "./validation";

describe("requireTitle", () => {
  it("returns the trimmed value", () => {
    expect(requireTitle("  Book checkup  ", "Thread title")).toBe(
      "Book checkup",
    );
  });

  it("leaves an already-trimmed value alone", () => {
    expect(requireTitle("Book checkup", "Thread title")).toBe("Book checkup");
  });

  it("keeps the whitespace inside", () => {
    expect(requireTitle(" a  b ", "Thread title")).toBe("a  b");
  });

  it("rejects an empty value, naming the field", () => {
    expect(() => requireTitle("", "Note text")).toThrow(
      "Note text cannot be empty",
    );
  });

  it.each(["   ", "\t", "\n", " \t\n "])(
    "rejects whitespace-only %j",
    (value) => {
      expect(() => requireTitle(value, "Area name")).toThrow(
        "Area name cannot be empty",
      );
    },
  );
});

describe("RESERVED_AREA_SLUGS", () => {
  it("contains expected reserved slugs", () => {
    expect(RESERVED_AREA_SLUGS.has("threads")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("settings")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("sign-in")).toBe(true);
    expect(RESERVED_AREA_SLUGS.has("sign-up")).toBe(true);
  });
});

describe("validateAreaName", () => {
  it("accepts a normal area name", () => {
    expect(validateAreaName("Work")).toBe("Work");
  });

  it("returns the trimmed name", () => {
    expect(validateAreaName("  Work  ")).toBe("Work");
  });

  it("rejects a blank name", () => {
    expect(() => validateAreaName("  ")).toThrow("Area name cannot be empty");
  });

  it("checks the reserved list against the trimmed name", () => {
    expect(() => validateAreaName("  Threads  ")).toThrow(
      '"Threads" is reserved',
    );
  });

  it("accepts names that slugify differently from reserved words", () => {
    expect(() => validateAreaName("My Threads List")).not.toThrow();
  });

  it("rejects 'Threads' (case-insensitive via slugify)", () => {
    expect(() => validateAreaName("Threads")).toThrow('"Threads" is reserved');
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
