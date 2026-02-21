import { describe, expect, it } from "vitest";
import { generateSlug, slugify } from "./slugs";

describe("slugify", () => {
  it("lowercases text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric chars with hyphens", () => {
    expect(slugify("foo@bar!baz")).toBe("foo-bar-baz");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles all-special characters", () => {
    expect(slugify("@#$%")).toBe("");
  });
});

describe("generateSlug", () => {
  it("produces a slug with an 8-char hex suffix", () => {
    const slug = generateSlug("My Project");
    expect(slug).toMatch(/^my-project-[0-9a-f]{8}$/);
  });

  it("returns only the suffix for empty names", () => {
    const slug = generateSlug("");
    expect(slug).toMatch(/^[0-9a-f]{8}$/);
  });

  it("generates unique slugs for the same input", () => {
    const a = generateSlug("test");
    const b = generateSlug("test");
    expect(a).not.toBe(b);
  });
});
