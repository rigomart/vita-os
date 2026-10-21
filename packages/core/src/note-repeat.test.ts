import type { Repeat } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { ValidationError } from "./errors";
import {
  decideCompleteNote,
  decideNewNote,
  decideSetNoteFollowUp,
  decideSetNoteRepeat,
} from "./note-repeat";

const ms = (iso: string) => Date.parse(iso);
const monthly31: Repeat = { kind: "monthly", day: 31 };
const thursdays: Repeat = { kind: "weekly", weekdays: [4] };
const every3: Repeat = { kind: "days", every: 3 };

describe("setting a Note's date", () => {
  it("sets, changes and clears a one-off date without a zone", () => {
    expect(decideSetNoteFollowUp({}, ms("2026-11-05T09:00Z"))).toEqual({
      followUp: ms("2026-11-05T09:00Z"),
    });
    expect(
      decideSetNoteFollowUp(
        { followUp: ms("2026-11-05T09:00Z") },
        ms("2026-11-06T09:00Z"),
      ),
    ).toEqual({ followUp: ms("2026-11-06T09:00Z") });
  });

  it("clears the Repeat with the date", () => {
    expect(
      decideSetNoteFollowUp(
        { followUp: ms("2026-11-05T09:00Z"), repeat: monthly31 },
        null,
      ),
    ).toEqual({});
  });

  it("keeps an every-N-days Repeat on any new date, without a zone", () => {
    expect(
      decideSetNoteFollowUp(
        { followUp: ms("2026-11-05T09:00Z"), repeat: every3 },
        ms("2026-11-10T09:00Z"),
      ),
    ).toEqual({ followUp: ms("2026-11-10T09:00Z"), repeat: every3 });
  });

  it("snaps a weekly Note's new date to a chosen weekday", () => {
    // Tuesday Nov 10, 2026 snaps forward to Thursday Nov 12.
    expect(
      decideSetNoteFollowUp(
        { followUp: ms("2026-11-05T09:00Z"), repeat: thursdays },
        ms("2026-11-10T09:00Z"),
        "UTC",
      ),
    ).toEqual({ followUp: ms("2026-11-12T09:00Z"), repeat: thursdays });
  });

  it("moves a monthly Repeat to the new date's day, but not for a new time that day", () => {
    const feb28 = { followUp: ms("2027-02-28T09:00Z"), repeat: monthly31 };
    expect(
      decideSetNoteFollowUp(feb28, ms("2027-03-12T09:00Z"), "UTC"),
    ).toEqual({
      followUp: ms("2027-03-12T09:00Z"),
      repeat: { kind: "monthly", day: 12 },
    });
    expect(
      decideSetNoteFollowUp(feb28, ms("2027-02-28T17:00Z"), "UTC"),
    ).toEqual({ followUp: ms("2027-02-28T17:00Z"), repeat: monthly31 });
  });

  it("refuses a weekly or monthly Note's new date without a zone", () => {
    for (const repeat of [thursdays, monthly31]) {
      expect(() =>
        decideSetNoteFollowUp(
          { followUp: ms("2026-11-05T09:00Z"), repeat },
          ms("2026-11-10T09:00Z"),
        ),
      ).toThrow(ValidationError);
    }
  });

  it("refuses a date outside the Task range and an invalid zone", () => {
    expect(() => decideSetNoteFollowUp({}, -1)).toThrow(ValidationError);
    expect(() => decideSetNoteFollowUp({}, 1, "Mars/Olympus")).toThrow(
      ValidationError,
    );
  });

  it("reads a Repeat without a date as none", () => {
    expect(
      decideSetNoteFollowUp({ repeat: thursdays }, ms("2026-11-10T09:00Z")),
    ).toEqual({ followUp: ms("2026-11-10T09:00Z") });
  });
});

describe("setting a Note's Repeat", () => {
  const nov5 = { followUp: ms("2026-11-05T09:00Z") };

  it("keeps the date for every N days and a monthly Repeat on its day", () => {
    expect(decideSetNoteRepeat(nov5, every3, "UTC")).toEqual({
      ...nov5,
      repeat: every3,
    });
    expect(
      decideSetNoteRepeat(nov5, { kind: "monthly", day: 5 }, "UTC"),
    ).toEqual({ ...nov5, repeat: { kind: "monthly", day: 5 } });
  });

  it("snaps the date forward to a weekly or monthly Repeat's first day", () => {
    expect(decideSetNoteRepeat(nov5, thursdays, "UTC")).toEqual({
      followUp: ms("2026-11-05T09:00Z"),
      repeat: thursdays,
    });
    expect(
      decideSetNoteRepeat(nov5, { kind: "weekly", weekdays: [1] }, "UTC"),
    ).toEqual({
      followUp: ms("2026-11-09T09:00Z"),
      repeat: { kind: "weekly", weekdays: [1] },
    });
    expect(decideSetNoteRepeat(nov5, monthly31, "UTC")).toEqual({
      followUp: ms("2026-11-30T09:00Z"),
      repeat: monthly31,
    });
  });

  it("normalizes the Repeat and clears it, keeping the date", () => {
    expect(
      decideSetNoteRepeat(nov5, { kind: "weekly", weekdays: [4, 1] }, "UTC")
        .repeat,
    ).toEqual({ kind: "weekly", weekdays: [1, 4] });
    expect(
      decideSetNoteRepeat({ ...nov5, repeat: every3 }, null, "UTC"),
    ).toEqual(nov5);
  });

  it("refuses a Repeat on an undated Note, an invalid Repeat, or zone", () => {
    expect(() => decideSetNoteRepeat({}, every3, "UTC")).toThrow(
      "A Repeat requires a date",
    );
    expect(decideSetNoteRepeat({}, null, "UTC")).toEqual({});
    expect(() =>
      decideSetNoteRepeat(nov5, { kind: "monthly", day: 32 }, "UTC"),
    ).toThrow(ValidationError);
    expect(() => decideSetNoteRepeat(nov5, every3, "")).toThrow(
      ValidationError,
    );
  });
});

describe("a new Note", () => {
  const nov5 = ms("2026-11-05T09:00Z");

  it("takes a date alone without a zone", () => {
    expect(decideNewNote({})).toEqual({});
    expect(decideNewNote({ followUp: nov5 })).toEqual({ followUp: nov5 });
  });

  it("takes a Repeat with its date, snapping a weekly one", () => {
    expect(decideNewNote({ followUp: nov5, repeat: thursdays }, "UTC")).toEqual(
      { followUp: nov5, repeat: thursdays },
    );
    expect(
      decideNewNote(
        { followUp: nov5, repeat: { kind: "weekly", weekdays: [6] } },
        "UTC",
      ),
    ).toEqual({
      followUp: ms("2026-11-07T09:00Z"),
      repeat: { kind: "weekly", weekdays: [6] },
    });
  });

  it("refuses a Repeat without a date or a zone", () => {
    expect(() => decideNewNote({ repeat: every3 }, "UTC")).toThrow(
      "A Repeat requires a date",
    );
    expect(() => decideNewNote({ followUp: nov5, repeat: every3 })).toThrow(
      ValidationError,
    );
  });
});

describe("completing a Note", () => {
  const now = ms("2026-11-05T12:00Z");

  it("moves a monthly Note to the next month's day", () => {
    expect(
      decideCompleteNote(
        {
          followUp: ms("2026-11-05T09:00Z"),
          repeat: { kind: "monthly", day: 5 },
        },
        { timeZone: "UTC", now },
      ),
    ).toEqual({
      followUp: ms("2026-12-05T09:00Z"),
      repeat: { kind: "monthly", day: 5 },
    });
  });

  it("falls to a short month's end and returns to the chosen day", () => {
    const jan31 = { followUp: ms("2027-01-31T09:00Z"), repeat: monthly31 };
    const feb = decideCompleteNote(jan31, {
      timeZone: "UTC",
      now: ms("2027-01-31T12:00Z"),
    });
    expect(feb.followUp).toBe(ms("2027-02-28T09:00Z"));
    expect(
      decideCompleteNote(feb, { timeZone: "UTC", now: ms("2027-02-28T12:00Z") })
        .followUp,
    ).toBe(ms("2027-03-31T09:00Z"));
  });

  it("collapses missed occurrences into the first not before today", () => {
    expect(
      decideCompleteNote(
        {
          followUp: ms("2026-11-05T09:00Z"),
          repeat: { kind: "monthly", day: 5 },
        },
        { timeZone: "UTC", now: ms("2027-01-09T12:00Z") },
      ).followUp,
    ).toBe(ms("2027-02-05T09:00Z"));
    expect(
      decideCompleteNote(
        { followUp: ms("2026-11-05T09:00Z"), repeat: every3 },
        { timeZone: "UTC", now: ms("2026-11-09T12:00Z") },
      ).followUp,
    ).toBe(ms("2026-11-11T09:00Z"));
  });

  it("counts days in the caller's zone", () => {
    // 01:00 UTC on Nov 6 is 20:00 on Nov 5 in New York, and stays 20:00.
    expect(
      decideCompleteNote(
        {
          followUp: ms("2026-11-06T01:00Z"),
          repeat: { kind: "monthly", day: 5 },
        },
        { timeZone: "America/New_York", now },
      ).followUp,
    ).toBe(ms("2026-12-06T01:00Z"));
  });

  it("refuses a one-off or undated Note, and an invalid zone", () => {
    for (const note of [
      { followUp: ms("2026-11-05T09:00Z") },
      {},
      { repeat: every3 },
    ]) {
      expect(() => decideCompleteNote(note, { timeZone: "UTC", now })).toThrow(
        "Only a repeating Note can be completed",
      );
    }
    expect(() =>
      decideCompleteNote(
        { followUp: ms("2026-11-05T09:00Z"), repeat: every3 },
        { timeZone: "+01:00", now },
      ),
    ).toThrow(ValidationError);
  });
});
