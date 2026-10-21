import type { Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { BoardItem } from "./attention-board-model";

import { groupByWhen } from "./attention-board-model";
import { foldedSummary, groupLook, itemTitle } from "./dashboard-list-model";

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

  it("writes nearer headings larger, and Late in the attention colour", () => {
    const [late, today, tomorrow, , , august] = looks([-1, 0, 1, 2, 4, 40]);
    expect(late!.heading.label).toContain("text-condition-attention");
    expect(late!.heading.label).toContain("text-xl");
    expect(today!.heading.label).toContain("text-xl");
    expect(today!.heading.label).not.toContain("text-condition-attention");
    expect(tomorrow!.heading.label).toContain("text-lg");
    expect(august!.heading.label).toContain("text-[13px]");
  });

  it("writes nearer lines larger, and fades them with distance", () => {
    const [late, today, tomorrow, thursday, week, august] = looks([
      -1, 0, 1, 6, 9, 40,
    ]);
    expect(late!.line).toBe(today!.line);
    expect(today!.line.frame).toContain("text-[17px]");
    expect(today!.line.task).toBe("font-semibold");
    expect(tomorrow!.line.frame).toContain("text-[15px]");
    expect(thursday!.line.frame).toContain("text-foreground/75");
    expect(week!.line.frame).toContain("text-foreground/60");
    expect(august!.line.frame).toContain("text-foreground/50");
  });

  it("gives a day's number to the days only, not to the weeks and months", () => {
    const [today, thursday, week, august] = looks([0, 6, 9, 40]);
    expect(today!.heading.numeral).toContain("text-3xl");
    expect(thursday!.heading.numeral).not.toBe("");
    expect(week!.heading.numeral).toBe("");
    expect(august!.heading.numeral).toBe("");
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

describe("foldedSummary", () => {
  it("names the first two items and counts the rest", () => {
    expect(
      foldedSummary([
        threadItem("Marathon"),
        threadItem("Emergency fund"),
        noteItem("Wifi password"),
        noteItem("Book club"),
      ]),
    ).toBe("Marathon, Emergency fund and 2 more");
  });

  it("names one or two items without a count", () => {
    expect(foldedSummary([threadItem("Marathon")])).toBe("Marathon");
    expect(
      foldedSummary([threadItem("Marathon"), noteItem("Wifi password")]),
    ).toBe("Marathon, Wifi password");
  });
});
