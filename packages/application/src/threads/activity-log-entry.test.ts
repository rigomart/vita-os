import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ActivityLogEntryType,
} from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { readActivityLogEntry } from "./activity-log-entry";

function entry(
  type: ActivityLogEntryType,
  content: string,
  values: { previousValue?: string; newValue?: string } = {},
): ActivityLogEntry {
  return {
    _id: "log" as ActivityLogEntryId,
    type,
    content,
    ...values,
    createdAt: 0,
  };
}

function read(...args: Parameters<typeof entry>) {
  const { label, action, subject, from, note, dropped } = readActivityLogEntry(
    entry(...args),
  );
  return { label, action, subject, from, note, dropped };
}

describe("readActivityLogEntry", () => {
  it("reads a completed Task with its full text", () => {
    expect(
      read("move_completed", 'Completed "Call the clinic"', {
        previousValue: "Call the clinic",
      }),
    ).toMatchObject({
      label: "Task done",
      action: "Completed",
      subject: "Call the clinic",
    });
  });

  it("reads every Area change as what the Thread was moved to", () => {
    expect(
      read("area_move", "", { previousValue: "Home", newValue: "Work" }),
    ).toMatchObject({ action: "Moved to", subject: "Work", from: "Home" });
    expect(read("area_move", "", { newValue: "Work" })).toMatchObject({
      action: "Added to",
      subject: "Work",
    });
    expect(read("area_move", "", { previousValue: "Home" })).toMatchObject({
      action: "Removed from",
      subject: "Home",
    });
  });

  it("reads a resolution's note and the Tasks it dropped out of its content", () => {
    const values = { previousValue: "open", newValue: "resolved" };

    expect(
      read(
        "state_change",
        'Resolved thread: Done at the garage. — discarded tasks: "Book a slot", "Pay"',
        values,
      ),
    ).toMatchObject({
      label: "Resolved",
      action: "Resolved the Thread",
      note: "Done at the garage.",
      dropped: ["Book a slot", "Pay"],
    });
    expect(
      read("state_change", 'Resolved thread — discarded tasks: "Pay"', values),
    ).toMatchObject({ note: undefined, dropped: ["Pay"] });
    expect(read("state_change", "Resolved thread", values)).toMatchObject({
      note: undefined,
      dropped: [],
    });
  });

  it("reads a reopening", () => {
    expect(
      read("state_change", "Reopened thread", {
        previousValue: "resolved",
        newValue: "open",
      }),
    ).toMatchObject({ label: "Reopened", action: "Reopened the Thread" });
  });

  it("keeps the label and wording of entries written under a former name", () => {
    expect(
      read("next_move_change", 'Completed "Ring Sam"', {
        previousValue: "Ring Sam",
      }),
    ).toMatchObject({
      label: "Next move",
      action: "Completed",
      subject: "Ring Sam",
    });
    expect(
      read("follow_up_change", "Follow-up cleared", {
        previousValue: "May 20, 2026",
      }),
    ).toMatchObject({
      label: "Follow-up date",
      action: "Cleared the Follow-up",
      subject: "May 20, 2026",
    });
  });
});
