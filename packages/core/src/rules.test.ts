import { describe, expect, it } from "vitest";

import { clearedToAbsent } from "./clearable";
import { ConflictError, ValidationError } from "./errors";
import { generateSlug, slugify, validateAreaName } from "./slug";
import { requireNonBlankText } from "./text";
import {
  requireOpenForUpNext,
  requireUpNextMoves,
  storedUpNext,
  takeFrontUpNextMove,
} from "./up-next";

describe("text", () => {
  it("trims accepted text", () => {
    expect(requireNonBlankText("  Call clinic  ", "Next move")).toBe(
      "Call clinic",
    );
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

describe("Up Next", () => {
  it("stores a line of moves and forgets an empty one", () => {
    expect(storedUpNext(["Book slot"])).toEqual(["Book slot"]);
    expect(storedUpNext([])).toBeUndefined();
  });

  it("trims every move and refuses a blank one", () => {
    expect(requireUpNextMoves([" Book slot ", "Pay bill"])).toEqual([
      "Book slot",
      "Pay bill",
    ]);
    expect(() => requireUpNextMoves(["Book slot", "  "])).toThrow(
      new ValidationError("Upcoming move cannot be empty"),
    );
  });

  it("takes the front move off the line", () => {
    expect(takeFrontUpNextMove(["Book slot", "Pay bill"])).toEqual({
      nextMove: "Book slot",
      upNext: ["Pay bill"],
    });
    expect(takeFrontUpNextMove(["Book slot"])).toEqual({
      nextMove: "Book slot",
      upNext: undefined,
    });
    expect(takeFrontUpNextMove(undefined)).toBeNull();
    expect(takeFrontUpNextMove([])).toBeNull();
  });

  it("refuses to line up moves on a resolved Thread", () => {
    expect(() => requireOpenForUpNext({ state: "open" })).not.toThrow();
    expect(() => requireOpenForUpNext({ state: "resolved" })).toThrow(
      new ConflictError("Cannot line up moves on a resolved thread"),
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
