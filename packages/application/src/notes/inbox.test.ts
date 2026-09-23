import type { Note, NoteId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { isNoteWhenDue, isNoteWhenEmphasized } from "./inbox";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    _id: "note1" as NoteId,
    body: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

const may18_2026 = new Date(2026, 4, 18, 12).getTime();
const may19_2026 = new Date(2026, 4, 19, 12).getTime();
const may17_2026 = new Date(2026, 4, 17, 12).getTime();

describe("Note When emphasis", () => {
  it("treats When on or before today as due", () => {
    expect(isNoteWhenDue(may18_2026, may18_2026)).toBe(true);
    expect(isNoteWhenDue(may17_2026, may18_2026)).toBe(true);
    expect(isNoteWhenDue(may19_2026, may18_2026)).toBe(false);
    expect(isNoteWhenDue(undefined, may18_2026)).toBe(false);
  });

  it("emphasizes Open Notes with due When", () => {
    expect(
      isNoteWhenEmphasized(makeNote({ attentionDate: may17_2026 }), may18_2026),
    ).toBe(true);
    expect(
      isNoteWhenEmphasized(makeNote({ attentionDate: may19_2026 }), may18_2026),
    ).toBe(false);
    expect(
      isNoteWhenEmphasized(
        makeNote({ attentionDate: may17_2026, state: "done" }),
        may18_2026,
      ),
    ).toBe(false);
  });
});
