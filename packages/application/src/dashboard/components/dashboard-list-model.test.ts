import type { Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { BoardItem } from "./attention-board-model";

import { groupByWhen } from "./attention-board-model";
import {
  foldedNoDateSummary,
  groupLook,
  itemTitle,
  LATE_FILL,
} from "./dashboard-list-model";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const day = (offset: number) => new Date(2026, 6, 17 + offset).getTime();

function threadItem(title: string, when?: number): BoardItem {
  return {
    kind: "thread",
    thread: { _id: title, title, slug: title } as unknown as Thread,
    when,
  };
}

function noteItem(body: string, when?: number): BoardItem {
  return {
    kind: "note",
    note: { _id: body, body } as unknown as Note,
    when,
  };
}

/** Each group's label and how it reads, nearest first. */
function looks(offsets: number[]) {
  return groupByWhen(
    offsets.map((offset) => threadItem(`at ${offset}`, day(offset))),
    currentDate,
  ).map((group) => ({ label: group.label, ...groupLook(group) }));
}

describe("groupLook", () => {
  it("steps a group's distance out from Late and Today to the months", () => {
    expect(
      looks([-2, 0, 1, 2, 3, 4, 6, 7, 20, 40]).map(({ label, distance }) => [
        label,
        distance,
      ]),
    ).toEqual([
      ["Late", 0],
      ["Today", 0],
      ["Tomorrow", 1],
      ["Sunday", 2],
      ["Monday", 2],
      ["Tuesday", 3],
      ["Thursday", 3],
      ["In 1 week", 4],
      ["In 2 weeks", 4],
      ["August", 5],
    ]);
  });

  it("turns items into one line each from next week on", () => {
    expect(
      looks([0, 6, 7, 40]).map(({ label, oneLine }) => [label, oneLine]),
    ).toEqual([
      ["Today", false],
      ["Thursday", false],
      ["In 1 week", true],
      ["August", true],
    ]);
  });

  it("fills Late warm, raises Today most, then less with distance", () => {
    const [late, today, tomorrow, monday, tuesday, week] = looks([
      -1, 0, 1, 3, 4, 9,
    ]);
    expect(late!.fill).toBe(LATE_FILL);
    expect(today!.fill).toBe("bg-surface-2");
    expect(tomorrow!.fill).toContain("var(--color-surface-2)_70%");
    expect(monday!.fill).toBe(tomorrow!.fill);
    expect(tuesday!.fill).toContain("var(--color-surface-2)_45%");
    expect(week!.fill).toBe(tuesday!.fill);
  });

  it("writes nearer headings larger, and Late in the attention colour", () => {
    const [late, today, tomorrow, , , august] = looks([-1, 0, 1, 2, 4, 40]);
    expect(late!.heading).toContain("text-condition-attention");
    expect(late!.heading).toContain("text-xl");
    expect(today!.heading).toContain("text-xl");
    expect(today!.heading).not.toContain("text-condition-attention");
    expect(tomorrow!.heading).toContain("text-lg");
    expect(august!.heading).toContain("text-sm");
  });
});

describe("itemTitle", () => {
  it("names a Thread by its title and a Note by its first plain line", () => {
    expect(itemTitle(threadItem("Passport"))).toBe("Passport");
    expect(itemTitle(noteItem("\n## Call **the bank**\nabout the card"))).toBe(
      "Call the bank",
    );
  });
});

describe("foldedNoDateSummary", () => {
  it("names the first two items and counts the rest", () => {
    expect(
      foldedNoDateSummary([
        threadItem("Marathon"),
        threadItem("Emergency fund"),
        noteItem("Wifi password"),
        noteItem("Book club"),
      ]),
    ).toBe("Marathon, Emergency fund and 2 more");
  });

  it("names one or two items without a count", () => {
    expect(foldedNoDateSummary([threadItem("Marathon")])).toBe("Marathon");
    expect(
      foldedNoDateSummary([threadItem("Marathon"), noteItem("Wifi password")]),
    ).toBe("Marathon, Wifi password");
  });
});
