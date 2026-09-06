import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";

import { describe, expect, it } from "vitest";

import {
  isNoteWhenDue,
  isNoteWhenEmphasized,
  removeNoteFromInbox,
  updateNoteWhenInInbox,
} from "./inbox";

function makeNote(overrides: Partial<ProjectedNote> = {}): ProjectedNote {
  return {
    _id: "note1" as Id<"tasks">,
    _creationTime: 0,
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
      isNoteWhenEmphasized(makeNote({ when: may17_2026 }), may18_2026),
    ).toBe(true);
    expect(
      isNoteWhenEmphasized(makeNote({ when: may19_2026 }), may18_2026),
    ).toBe(false);
    expect(
      isNoteWhenEmphasized(
        makeNote({ when: may17_2026, state: "done" }),
        may18_2026,
      ),
    ).toBe(false);
  });
});

describe("Note inbox mutations", () => {
  it("removes a Note from the open Inbox list — completing and discarding both take it out", () => {
    const keeping = makeNote({ _id: "keeping" as Id<"tasks"> });
    const removing = makeNote({ _id: "removing" as Id<"tasks"> });

    expect(removeNoteFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("is a no-op when the Note isn't in the cached open list", () => {
    const keeping = makeNote({ _id: "keeping" as Id<"tasks"> });

    expect(removeNoteFromInbox([keeping], "elsewhere" as Id<"tasks">)).toEqual([
      keeping,
    ]);
  });

  it("updates or clears Note When without removing the Note from the Inbox", () => {
    const updating = makeNote({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeNote({ _id: "unchanged" as Id<"tasks"> });

    const withWhen = updateNoteWhenInInbox(
      [updating, unchanged],
      updating._id,
      may19_2026,
    );

    expect(withWhen).toEqual([{ ...updating, when: may19_2026 }, unchanged]);
    expect(updateNoteWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, when: undefined },
      unchanged,
    ]);
  });
});
