import { describe, expect, it } from "vitest";

import { clearedToAbsent } from "./clearable";
import { ConflictError, ValidationError } from "./errors";
import { requireMoveId, requireMoveText, requireOpenForMoves } from "./moves";
import { generateSlug, slugify, validateAreaName } from "./slug";
import { requireNonBlankText } from "./text";

describe("text", () => {
  it("trims accepted text", () => {
    expect(requireNonBlankText("  Call clinic  ", "Move")).toBe("Call clinic");
  });

  it("refuses blank text by the caller's label", () => {
    expect(() => requireNonBlankText("   ", "Note body")).toThrow(
      new ValidationError("Note body cannot be empty"),
    );
  });
});

describe("slugs", () => {
  it("slugifies to lowercase dashes", () => {
    expect(slugify("Health & Fitness!")).toBe("health-fitness");
    expect(slugify("  Spaced  out  ")).toBe("spaced-out");
    expect(slugify("!!!")).toBe("");
  });

  it("appends eight hex characters of randomness", () => {
    expect(generateSlug("Health")).toMatch(/^health-[0-9a-f]{8}$/);
  });

  it("falls back to the suffix alone when a name slugifies to nothing", () => {
    expect(generateSlug("!!!")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("validateAreaName", () => {
  it("returns the trimmed name", () => {
    expect(validateAreaName("  Health  ")).toBe("Health");
  });

  it("refuses a blank name", () => {
    expect(() => validateAreaName(" ")).toThrow(ValidationError);
  });

  it("refuses names that would take a reserved route", () => {
    expect(() => validateAreaName("Threads")).toThrow(
      new ValidationError(
        '"Threads" is reserved and cannot be used as an area name',
      ),
    );
    expect(() => validateAreaName("sign in")).toThrow(ValidationError);
  });
});

describe("Move input", () => {
  it("trims a Move and refuses a blank one", () => {
    expect(requireMoveText(" Book slot ")).toBe("Book slot");
    expect(() => requireMoveText("  ")).toThrow(
      new ValidationError("Move cannot be empty"),
    );
  });

  it("refuses a Move ID that no row could hold", () => {
    expect(requireMoveId("move-1")).toBe("move-1");
    expect(() => requireMoveId("")).toThrow(ValidationError);
    expect(() => requireMoveId("x".repeat(65))).toThrow(ValidationError);
  });

  it("refuses to change the Moves of a resolved Thread", () => {
    expect(() => requireOpenForMoves({ state: "open" })).not.toThrow();
    expect(() => requireOpenForMoves({ state: "resolved" })).toThrow(
      new ConflictError("Cannot change the moves of a resolved thread"),
    );
  });
});

describe("clearable values", () => {
  it("turns a cleared value into an absent one, keeping the key", () => {
    const patch = clearedToAbsent({ summary: null, title: "New" });

    expect(patch).toEqual({ summary: undefined, title: "New" });
    expect(Object.keys(patch).sort()).toEqual(["summary", "title"]);
  });
});
