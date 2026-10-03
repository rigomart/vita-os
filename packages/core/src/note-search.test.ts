import { describe, expect, it } from "vitest";

import { ValidationError } from "./errors";
import {
  boundNoteSearch,
  matchesNoteSearch,
  NOTE_SEARCH_MAX_LENGTH,
  NOTE_SEARCH_MAX_TERMS,
  noteSearchTerms,
} from "./note-search";

describe("archived Note search terms", () => {
  it("splits a search into distinct words", () => {
    expect(noteSearchTerms("  milk   eggs milk ")).toEqual(["milk", "eggs"]);
  });

  it("reads a blank search as no words", () => {
    expect(noteSearchTerms("   ")).toEqual([]);
  });

  it("refuses a search past its bounds", () => {
    expect(() =>
      noteSearchTerms("a".repeat(NOTE_SEARCH_MAX_LENGTH + 1)),
    ).toThrow(ValidationError);
    const words = Array.from(
      { length: NOTE_SEARCH_MAX_TERMS + 1 },
      (_, i) => `w${i}`,
    );
    expect(() => noteSearchTerms(words.join(" "))).toThrow(ValidationError);
  });

  it("bounds what a client sends so typing never makes a refused search", () => {
    const words = Array.from(
      { length: NOTE_SEARCH_MAX_TERMS + 3 },
      (_, i) => `w${i}`,
    );
    const bounded = boundNoteSearch(words.join("  "));

    expect(noteSearchTerms(bounded)).toEqual(
      words.slice(0, NOTE_SEARCH_MAX_TERMS),
    );
    const long = boundNoteSearch(`${"a".repeat(150)} ${"b".repeat(100)}`);
    expect(long).toBe("a".repeat(150));
    expect(() => noteSearchTerms(long)).not.toThrow();
  });

  it("matches a body containing every word, in any order or case", () => {
    expect(matchesNoteSearch("Buy MILK and eggs", "eggs milk")).toBe(true);
    expect(matchesNoteSearch("Buy milk", "milk bread")).toBe(false);
    expect(matchesNoteSearch("Anything", "  ")).toBe(true);
  });
});
