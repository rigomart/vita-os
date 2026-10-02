import type { Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { buildAttentionBoard, itemId } from "./attention-board-model";
import { DAY } from "./dashboard-model";
import { buildHorizon } from "./later-horizon-model";

// A Friday; nine weeks out is Sep 18, so the horizon ends with September.
const currentDate = new Date(2026, 6, 17, 12).getTime();
const day = (offset: number) => currentDate + offset * DAY;

function thread(id: string, followUp: number, order = 0): Thread {
  return {
    _id: id as Thread["_id"],
    title: id,
    slug: id,
    order,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    followUp,
  } as Thread;
}

function note(id: string, followUp: number): Note {
  return {
    _id: id as Note["_id"],
    body: id,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    followUp,
  } as Note;
}

function horizonOf(threads: Thread[], notes: Note[] = []) {
  const board = buildAttentionBoard(threads, notes, currentDate);
  return buildHorizon(board.later, currentDate);
}

describe("buildHorizon", () => {
  it("bands the next three weeks, then calendar months to the end of the month nine weeks out", () => {
    const { bands, end } = horizonOf([]);
    const span = end - 7;

    expect(end).toBe(76);
    expect(bands.map(({ key: _key, ...band }) => band)).toEqual([
      { label: "1w", from: 0, to: 7 / span },
      { label: "2w", from: 7 / span, to: 14 / span },
      { label: "3w", from: 14 / span, to: 21 / span },
      { label: "Aug", from: 21 / span, to: 39 / span },
      { label: "Sep", from: 39 / span, to: 1 },
    ]);
  });

  it("leaves a sliver of a month unlabeled", () => {
    // From Jul 29, day 28 is Aug 26: August has six days left on the scale.
    const lateInMonth = new Date(2026, 6, 29, 12).getTime();
    const { bands } = buildHorizon([], lateInMonth);

    expect(bands[3]).toMatchObject({ key: "month-2026-08" });
    expect(bands[3]).not.toHaveProperty("label");
  });

  it("marks each item at its day, flags the soonest, and counts what runs past the end", () => {
    const { marks, beyond, end } = horizonOf(
      [thread("budget", day(11)), thread("tax", day(80), 1)],
      [note("dentist", day(21))],
    );
    const span = end - 7;

    expect(
      marks.map((mark) => ({
        id: itemId(mark.item),
        at: mark.at,
        next: mark.next,
      })),
    ).toEqual([
      { id: "budget", at: 4.5 / span, next: true },
      { id: "dentist", at: 14.5 / span, next: false },
    ]);
    expect(beyond).toBe(1);
  });

  it("sets items due the same day side by side", () => {
    const { marks } = horizonOf([
      thread("one", day(12)),
      thread("two", day(12), 1),
      thread("three", day(13), 2),
    ]);

    expect(marks.map(({ slot, of }) => ({ slot, of }))).toEqual([
      { slot: 0, of: 2 },
      { slot: 1, of: 2 },
      { slot: 0, of: 1 },
    ]);
  });
});
